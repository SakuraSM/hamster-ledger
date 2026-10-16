import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  planImport,
  pendingMatchCandidates,
  unpairedPendingRecords,
  resolvePendingRecord,
  resolveReview,
  summarize,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";

function ambiguousLedger(): Ledger {
  const payment: BillRecord = {
    id: "payment-a",
    date: "2026-10-15 12:00:00",
    merchant: "虚拟商户 A",
    description: "",
    amount: 3600,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "支付宝",
    account: "虚拟银行卡",
    orderId: "ORDER-A",
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "synthetic.csv",
    raw: { remark: "保留原始字段" },
    linkedSources: [],
  };
  return planImport(EMPTY_LEDGER, [
    payment,
    { ...payment, id: "payment-b", orderId: "ORDER-B", merchant: "虚拟商户 B" },
    { ...payment, id: "bank", orderId: "BANK", source: "招商银行" },
  ]).ledger;
}

describe("unpaired pending record resolution", () => {
  it("exposes ambiguous imports and only links the explicitly selected candidate", () => {
    const ledger = ambiguousLedger();
    const [record] = unpairedPendingRecords(ledger);
    const candidates = pendingMatchCandidates(ledger, record);
    expect(candidates.map((item) => item.id)).toEqual([
      "payment-a",
      "payment-b",
    ]);
    const resolved = resolvePendingRecord(ledger, {
      record,
      candidate: candidates[1],
      decision: "link",
    });
    expect(resolved.records.find((item) => item.id === "bank")).toMatchObject({
      status: "duplicate",
      duplicateOf: "payment-b",
      raw: record.raw,
    });
    expect(resolved.records.find((item) => item.id === "payment-a")).toEqual(
      ledger.records[0],
    );
    expect(summarize(resolved.records).expense).toBe(7200);
    expect(unpairedPendingRecords(resolved)).toEqual([]);
    expect(resolved.reviews[0].state).toBe("linked");
    expect(ledger.records[2].status).toBe("pending");
  });
  it("can explicitly confirm an independent transaction without changing either candidate", () => {
    const ledger = ambiguousLedger(),
      record = ledger.records[2];
    const resolved = resolvePendingRecord(ledger, {
      record,
      decision: "confirm",
    });
    expect(resolved.records.slice(0, 2)).toEqual(ledger.records.slice(0, 2));
    expect(summarize(resolved.records).expense).toBe(10800);
    expect(resolved.records[2].reason).toBeUndefined();
    expect(() =>
      resolvePendingRecord(resolved, { record, decision: "confirm" }),
    ).toThrow("变化");
  });
  it("rejects stale, deleted or unavailable candidates without modifying the ledger", () => {
    const ledger = ambiguousLedger(),
      record = ledger.records[2],
      candidate = ledger.records[0];
    for (const changed of [
      {
        ...ledger,
        records: ledger.records.map((item) =>
          item.id === record.id ? { ...item, isDeleted: true } : item,
        ),
      },
      {
        ...ledger,
        records: ledger.records.map((item) =>
          item.id === candidate.id ? { ...item, amount: 4000 } : item,
        ),
      },
      {
        ...ledger,
        reviews: [
          {
            id: "used",
            leftId: candidate.id,
            rightId: "previous",
            state: "separate" as const,
            reasons: [],
          },
        ],
      },
    ]) {
      const snapshot = JSON.stringify(changed);
      expect(() =>
        resolvePendingRecord(changed, { record, candidate, decision: "link" }),
      ).toThrow();
      expect(JSON.stringify(changed)).toBe(snapshot);
    }
  });
  it("keeps paired pending records in their existing review flow", () => {
    const ledger = ambiguousLedger();
    const paired = planImport(
      { ...EMPTY_LEDGER, records: [ledger.records[0]] },
      [ledger.records[2]],
    ).ledger;
    expect(unpairedPendingRecords(paired)).toEqual([]);
    expect(() =>
      resolvePendingRecord(paired, {
        record: paired.records[1],
        decision: "confirm",
      }),
    ).toThrow("变化");
  });
  it("does not merge two explicitly different asset accounts", () => {
    const ledger = ambiguousLedger();
    ledger.records[0].accountId = "cash-a";
    ledger.records[2].accountId = "cash-b";
    expect(() =>
      resolvePendingRecord(ledger, {
        record: ledger.records[2],
        candidate: ledger.records[0],
        decision: "link",
      }),
    ).toThrow("不同资产账户");
    expect(ledger.records[2].status).toBe("pending");
  });
});

describe("paired review state guards", () => {
  it("rejects applying a completed or removed review again", () => {
    const source = ambiguousLedger();
    const ledger = planImport(
      { ...EMPTY_LEDGER, records: [source.records[0]] },
      [source.records[2]],
    ).ledger;
    const review = ledger.reviews[0];
    const resolved = resolveReview({ ledger, review, decision: "linked" });
    expect(() =>
      resolveReview({ ledger: resolved, review, decision: "separate" }),
    ).toThrow("核对");
    expect(() =>
      resolveReview({
        ledger: { ...ledger, reviews: [] },
        review,
        decision: "linked",
      }),
    ).toThrow("核对");
  });
});
