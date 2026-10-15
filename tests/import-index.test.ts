import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  planImport,
  createFinanceFilter,
  matchesFinanceFilters,
  type FinanceFilter,
  type TransactionDetail,
  batchRecords,
  restoreEntry,
  type BillRecord,
} from "@hamster-ledger/core";

function record(id: string, changes: Partial<BillRecord> = {}): BillRecord {
  return {
    id,
    date: "2026-10-03 12:00:00",
    merchant: "虚拟午餐",
    description: "",
    amount: 3600,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "支付宝",
    account: "虚拟银行卡",
    orderId: id,
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "synthetic.csv",
    raw: {},
    linkedSources: [],
    ...changes,
  };
}

describe("import matching boundaries", () => {
  it.each([
    ["2026-10-01 12:00:00", 1],
    ["2026-10-01 11:59:59", 0],
    ["2026-10-05 12:00:00", 1],
    ["2026-10-05 12:00:01", 0],
  ])("keeps the exact two-day window for %s", (date, expected) => {
    const result = planImport(
      { ...EMPTY_LEDGER, records: [record("original")] },
      [record("bank", { source: "招商银行", date })],
    );
    expect(result.pending).toBe(expected);
    expect(result.ledger.reviews).toHaveLength(expected);
  });

  it("ignores deleted, duplicate, used and unrelated candidates", () => {
    const records = [
      record("deleted", { isDeleted: true }),
      record("duplicate", { status: "duplicate", duplicateOf: "used" }),
      record("used"),
      record("wrong-account", { account: "另一银行卡" }),
      record("wrong-amount", { amount: 3601 }),
      record("invalid-date", { date: "invalid" }),
      record("valid"),
    ];
    const ledger = {
      ...EMPTY_LEDGER,
      records,
      reviews: [
        {
          id: "previous",
          leftId: "used",
          rightId: "duplicate",
          state: "linked" as const,
          reasons: [],
        },
      ],
    };
    const result = planImport(ledger, [record("bank", { source: "招商银行" })]);
    expect(result.ledger.reviews[1]).toMatchObject({
      leftId: "valid",
      rightId: "bank",
    });
    expect(ledger.records).toEqual(records);
  });

  it("matches within the incoming batch and never assigns a candidate twice", () => {
    const result = planImport(EMPTY_LEDGER, [
      record("payment"),
      record("bank", { source: "招商银行" }),
      record("bank-2", { source: "招商银行" }),
    ]);
    expect(result.ledger.reviews).toHaveLength(1);
    expect(result.ledger.records.map((item) => item.status)).toEqual([
      "confirmed",
      "pending",
      "confirmed",
    ]);
  });

  it("retains ambiguity and does not match two payment platforms", () => {
    const result = planImport(EMPTY_LEDGER, [
      record("payment-1"),
      record("payment-2"),
      record("wechat", { source: "微信支付" }),
      record("bank", { source: "招商银行" }),
    ]);
    expect(result.ledger.reviews).toEqual([]);
    expect(result.ledger.records.at(-1)?.status).toBe("pending");
    expect(result.ledger.records[2].status).toBe("confirmed");
  });

  it("resolves an exact duplicate through its existing canonical chain", () => {
    const original = record("original");
    const duplicate = record("duplicate", {
      status: "duplicate",
      duplicateOf: original.id,
    });
    const result = planImport(
      { ...EMPTY_LEDGER, records: [original, duplicate] },
      [
        record("incoming", { orderId: duplicate.orderId }),
        record("again", { orderId: duplicate.orderId }),
      ],
    );
    expect(result.duplicate).toBe(2);
    expect(
      result.ledger.records.slice(2).map((item) => item.duplicateOf),
    ).toEqual(["original", "original"]);
  });
});

describe("indexed reimbursement filtering", () => {
  it("agrees with per-record filtering for partial, full and ignored returns", () => {
    const detail: TransactionDetail = {
      type: "expense",
      original: {
        currency: "CNY",
        minor: 3600,
        rate: "1",
        date: "2026-10-03",
        source: "manual",
      },
      memberId: "member-a",
      splits: [{ memberId: "member-b", amount: 3600 }],
      movements: [{ accountId: "cash", amount: -3600 }],
      attachmentIds: [],
      origin: "manual",
      isReimbursable: true,
    };
    const ledger = {
      ...EMPTY_LEDGER,
      records: [
        record("partial", { detail }),
        record("settled", { detail }),
        record("pending", { detail }),
        record("ordinary"),
        ...["partial", "settled", "pending", "pending", "pending"].map(
          (relatedId, index) =>
            record(`return-${index}`, {
              kind: "退款",
              amount: index === 0 ? 1200 : 3600,
              status:
                index === 2
                  ? "pending"
                  : index === 3
                    ? "duplicate"
                    : "confirmed",
              isDeleted: index === 4,
              detail: {
                ...detail,
                type: "reimburse",
                relatedId,
                isReimbursable: false,
                splits: [],
              },
            }),
        ),
      ],
    };
    const filters: FinanceFilter[] = [
      {},
      { reimbursement: "partial" },
      { reimbursement: "settled" },
      { reimbursement: "pending" },
      { reimbursement: "none" },
      { reimbursement: "partial", memberId: "member-b", accountId: "cash" },
      { memberId: "missing" },
      { accountId: "missing" },
    ];
    for (const filter of filters) {
      expect(
        ledger.records.filter(createFinanceFilter(ledger, filter)),
      ).toEqual(
        ledger.records.filter((item) =>
          matchesFinanceFilters(ledger, item, filter),
        ),
      );
    }
    expect(
      ledger.records
        .filter(createFinanceFilter(ledger, { reimbursement: "pending" }))
        .map((item) => item.id),
    ).toEqual(["pending"]);
  });
});

describe("batch deletion of linked transactions", () => {
  it("moves the complete transaction group to trash and restores it together", () => {
    const original = record("original");
    const ledger = {
      ...EMPTY_LEDGER,
      records: [
        original,
        record("bank", {
          source: "招商银行",
          status: "duplicate",
          duplicateOf: "original",
        }),
        record("repeat", { status: "duplicate", duplicateOf: "bank" }),
        record("other"),
      ],
    };
    const deleted = batchRecords(ledger, {
      records: [original],
      action: "delete",
    });
    expect(
      deleted.records.filter((item) => item.isDeleted).map((item) => item.id),
    ).toEqual(["original", "bank", "repeat"]);
    expect(
      restoreEntry(deleted, "bank").records.every((item) => !item.isDeleted),
    ).toBe(true);
    expect(ledger.records.every((item) => !item.isDeleted)).toBe(true);
  });
  it("blocks batch deletion while a selected transaction has a pending review", () => {
    const ledger = planImport(EMPTY_LEDGER, [
      record("payment"),
      record("bank", { source: "招商银行" }),
    ]).ledger;
    expect(() =>
      batchRecords(ledger, { records: [ledger.records[0]], action: "delete" }),
    ).toThrow("核对");
    expect(ledger.records.every((item) => !item.isDeleted)).toBe(true);
  });
});
