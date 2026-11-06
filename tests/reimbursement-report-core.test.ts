import { describe, expect, it } from "vitest";
import * as core from "../packages/ledger-core/src/index";
import type {
  AdvancedEntryInput,
  BillRecord,
  Ledger,
} from "@hamster-ledger/core";

function input(
  id: string,
  amount: number,
  type: "expense" | "reimburse" | "refund",
  date: string,
  relatedId?: string,
): AdvancedEntryInput {
  return {
    id,
    date: date + " 12:00:00",
    merchant: id,
    category: "购物",
    accountId: "cash",
    detail: {
      type,
      original: {
        currency: "CNY",
        minor: amount,
        rate: "1",
        date,
        source: "manual",
      },
      relatedId,
      isReimbursable: type === "expense",
      splits: [],
      movements: [],
      attachmentIds: [],
      origin: "manual",
    },
  };
}
function fixture(): Ledger {
  let ledger = core.migrateLedger({
    ...core.EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name: "现金",
        kind: "asset",
        type: "现金",
        openingBalance: 100000,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        isArchived: false,
        checkpoints: [],
      },
    ],
  });
  ledger = core.saveAdvancedEntry(
    ledger,
    input("expense", 20000, "expense", "2026-10-05"),
  );
  return core.saveAdvancedEntry(
    ledger,
    input("received", 8000, "reimburse", "2026-10-06", "expense"),
  );
}
function copy(record: BillRecord, changes: Partial<BillRecord>): BillRecord {
  return { ...record, ...changes };
}

describe("reimbursement report accounting", () => {
  it("reports 200 yuan expense, 80 received and 120 outstanding in integer minor units", () => {
    const ledger = fixture();
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report).toMatchObject({ received: 8000, outstanding: 12000 });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      record: { id: "expense" },
      received: 8000,
      outstanding: 12000,
      returns: [{ id: "received" }],
    });
  });
  it("only counts selected original expenses and confirmed non-deleted non-duplicate returns through the end date", () => {
    const ledger = fixture();
    const expense = ledger.records.find((record) => record.id === "expense")!;
    const received = ledger.records.find((record) => record.id === "received")!;
    ledger.records.push(
      copy(expense, { id: "other-month", date: "2026-09-30 12:00:00" }),
      copy(expense, { id: "pending-expense", status: "pending" }),
      copy(expense, { id: "deleted-expense", isDeleted: true }),
      copy(expense, {
        id: "duplicate-expense",
        status: "duplicate",
        duplicateOf: "expense",
      }),
      copy(expense, {
        id: "not-reimbursable",
        detail: { ...expense.detail!, isReimbursable: false },
      }),
      copy(received, { id: "later", date: "2026-11-01 00:00:00", amount: 500 }),
      copy(received, { id: "pending", status: "pending", amount: 500 }),
      copy(received, { id: "deleted", isDeleted: true, amount: 500 }),
      copy(received, {
        id: "duplicate",
        status: "duplicate",
        duplicateOf: "received",
        amount: 500,
      }),
      copy(received, {
        id: "other",
        detail: { ...received.detail!, relatedId: "other-month" },
        amount: 500,
      }),
      copy(received, {
        id: "refund-before-start",
        date: "2026-09-30 12:00:00",
        amount: 2000,
        detail: { ...received.detail!, type: "refund" },
      }),
    );
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows.map((row) => row.record.id)).toEqual(["expense"]);
    expect(report.rows[0].returns.map((record) => record.id).sort()).toEqual([
      "received",
      "refund-before-start",
    ]);
    expect(report).toMatchObject({ received: 10000, outstanding: 10000 });
    expect(
      core.reimbursementReport({
        ledger,
        start: "2026-10-01",
        end: "2026-10-05",
      }),
    ).toMatchObject({ received: 2000, outstanding: 18000 });
    expect(
      core.reimbursementReport({
        ledger,
        start: "2026-11-01",
        end: "2026-10-01",
      }).rows,
    ).toEqual([]);
  });
  it("marks confirmed duplicate pointers as conflicts without changing any records", () => {
    const ledger = fixture();
    const received = ledger.records.find((record) => record.id === "received")!;
    ledger.records.push(
      copy(received, { id: "confirmed-copy", duplicateOf: "received" }),
    );
    const original = JSON.stringify(ledger);
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report).toMatchObject({ received: null, outstanding: null });
    expect(report.rows[0]).toMatchObject({
      hasConflict: true,
      received: null,
      outstanding: null,
      currentAvailable: null,
      anomalies: [{ id: "confirmed-copy" }],
    });
    expect(JSON.stringify(ledger)).toBe(original);
  });
  it("includes an anomalous confirmed original for inspection but refuses to calculate it", () => {
    const ledger = fixture();
    ledger.records[0] = { ...ledger.records[0], duplicateOf: "older-record" };
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows[0]).toMatchObject({
      record: { id: "expense" },
      hasConflict: true,
      outstanding: null,
    });
    expect(report.outstanding).toBeNull();
  });
  it("marks an original expense with an inconsistent transaction type as conflicting", () => {
    const ledger = fixture();
    ledger.records[0] = {
      ...ledger.records[0],
      detail: {
        ...ledger.records[0].detail!,
        type: "reimburse",
        relatedId: "older",
      },
    };
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows[0]).toMatchObject({
      record: { id: "expense" },
      hasConflict: true,
      currentAvailable: null,
    });
    expect(report.outstanding).toBeNull();
  });
  it("continues to count a reimbursable fee because fee is also an expense", () => {
    const ledger = fixture();
    ledger.records[0] = {
      ...ledger.records[0],
      detail: { ...ledger.records[0].detail!, type: "fee" },
    };
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows[0]).toMatchObject({
      hasConflict: false,
      outstanding: 12000,
    });
  });
  it.each(["refund-kind", "refund-type"] as const)(
    "marks a linked %s mismatch as a conflict",
    (mismatch) => {
      const ledger = fixture();
      const received = ledger.records.find(
        (record) => record.id === "received",
      )!;
      ledger.records.push(
        copy(
          received,
          mismatch === "refund-kind"
            ? {
                id: "inconsistent",
                detail: { ...received.detail!, type: "expense" },
              }
            : { id: "inconsistent", kind: "支出" },
        ),
      );
      const report = core.reimbursementReport({
        ledger,
        start: "2026-10-01",
        end: "2026-10-31",
      });
      expect(report.rows[0]).toMatchObject({
        hasConflict: true,
        anomalies: [{ id: "inconsistent" }],
      });
      expect(report.received).toBeNull();
    },
  );
  it("retains the historical cutoff while calculating the current limit from later receipts", () => {
    let ledger = fixture();
    ledger = core.saveAdvancedEntry(
      ledger,
      input("later-return", 12000, "reimburse", "2026-11-05", "expense"),
    );
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report).toMatchObject({ received: 8000, outstanding: 12000 });
    expect(report.rows[0]).toMatchObject({
      currentAvailable: 0,
      hasConflict: false,
      returns: [{ id: "received" }],
      laterReturns: [{ id: "later-return" }],
    });
    expect(() =>
      core.saveAdvancedEntry(
        ledger,
        input("extra", 1, "reimburse", "2026-11-06", "expense"),
      ),
    ).toThrow("累计金额");
  });
  it("uses the same current limit as saving when later repayments are partial", () => {
    let ledger = fixture();
    ledger = core.saveAdvancedEntry(
      ledger,
      input("later-return", 10000, "reimburse", "2026-11-05", "expense"),
    );
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows[0]).toMatchObject({
      outstanding: 12000,
      currentAvailable: 2000,
    });
    expect(() =>
      core.saveAdvancedEntry(
        ledger,
        input("too-much", 2001, "reimburse", "2026-11-06", "expense"),
      ),
    ).toThrow("累计金额");
    expect(
      core
        .saveAdvancedEntry(
          ledger,
          input("exact", 2000, "reimburse", "2026-11-06", "expense"),
        )
        .records.find((record) => record.id === "exact")?.amount,
    ).toBe(2000);
  });
  it("also blocks an anomalous later receipt because it affects the current limit", () => {
    const ledger = fixture();
    const received = ledger.records.find((record) => record.id === "received")!;
    ledger.records.push(
      copy(received, {
        id: "future-conflict",
        date: "2026-11-05 12:00:00",
        duplicateOf: "received",
      }),
    );
    const report = core.reimbursementReport({
      ledger,
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(report.rows[0]).toMatchObject({
      hasConflict: true,
      currentAvailable: null,
      anomalies: [{ id: "future-conflict" }],
    });
  });
});
