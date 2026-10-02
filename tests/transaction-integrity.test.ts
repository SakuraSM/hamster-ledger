import { it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  saveEntry,
  deleteEntry,
  restoreEntry,
  planImport,
  summarize,
  ledgerSchema,
  type EntryInput,
  type Ledger,
} from "@hamster-ledger/core";
const entry: EntryInput = {
  id: "bill",
  date: "2026-09-20 12:00:00",
  merchant: "合成午餐",
  amount: 10000,
  kind: "支出",
  category: "餐饮",
  description: "初始备注",
  tags: [],
  accountId: null,
  transferToAccountId: null,
};
it("rejects stale bill edits after a remote update, including a note-only edit", () => {
  const initial = saveEntry(EMPTY_LEDGER, entry);
  const remote = saveEntry(initial, { ...entry, amount: 20000 });
  expect(() =>
    saveEntry(remote, {
      ...entry,
      expectedRecord: initial.records[0],
      description: "本机只改备注",
    }),
  ).toThrow("已发生变化");
  expect(remote.records[0].amount).toBe(20000);
});
it("does not recreate a remotely removed bill from a stale editor", () => {
  const initial = saveEntry(EMPTY_LEDGER, entry);
  const input = { ...entry, expectedRecord: initial.records[0] };
  expect(() => saveEntry(EMPTY_LEDGER, input)).toThrow("已发生变化");
});
it("accepts an unchanged edit baseline and preserves other records", () => {
  const initial = saveEntry(EMPTY_LEDGER, entry);
  const other = saveEntry(initial, { ...entry, id: "other", amount: 5000 });
  const input = {
    ...entry,
    expectedRecord: initial.records[0],
    description: "新备注",
  };
  const result = saveEntry(other, input);
  expect(result.records.map((record) => record.amount)).toEqual([10000, 5000]);
  expect(result.records[0].description).toBe("新备注");
});
it.each(["not-a-date", "2026-02-30 12:00:00", "2026-09-20 24:00:00"])(
  "rejects invalid record dates at the storage boundary: %s",
  (date) => {
    const initial = saveEntry(EMPTY_LEDGER, entry);
    expect(
      ledgerSchema.safeParse({
        ...initial,
        records: [{ ...initial.records[0], date }],
      }).success,
    ).toBe(false);
  },
);
function legacyGroup(): Ledger {
  const base = saveEntry(EMPTY_LEDGER, entry).records[0];
  return {
    ...EMPTY_LEDGER,
    records: [
      { ...base, id: "A" },
      { ...base, id: "B", status: "duplicate", duplicateOf: "A" },
      { ...base, id: "C", status: "duplicate", duplicateOf: "B" },
    ],
  };
}
it("deletes and restores the complete legacy duplicate chain", () => {
  const removed = deleteEntry(legacyGroup(), "C");
  expect(removed.records.every((record) => record.isDeleted)).toBe(true);
  expect(summarize(removed.records).expense).toBe(0);
  const restored = restoreEntry(removed, "B");
  expect(restored.records.every((record) => !record.isDeleted)).toBe(true);
  expect(summarize(restored.records).expense).toBe(10000);
});
it("checks pending reviews for the whole duplicate group", () => {
  const ledger = legacyGroup();
  ledger.reviews = [
    {
      id: "review",
      leftId: "A",
      rightId: "another",
      state: "pending",
      reasons: [],
    },
  ];
  expect(() => deleteEntry(ledger, "C")).toThrow("核对");
});
it("points repeated imports to the original transaction instead of another duplicate", () => {
  const record = {
    ...legacyGroup().records[0],
    source: "支付宝" as const,
    orderId: "same-order",
  };
  let ledger: Ledger = { ...EMPTY_LEDGER, records: [record] };
  ledger = planImport(ledger, [{ ...record, id: "B" }]).ledger;
  ledger = planImport(ledger, [{ ...record, id: "C" }]).ledger;
  expect(ledger.records.find((item) => item.id === "C")?.duplicateOf).toBe("A");
});
it("rejects invalid planning dates before saving or syncing a ledger", () => {
  const rule = {
    id: "rule",
    name: "测试",
    merchant: "测试",
    amount: 100,
    kind: "支出",
    category: "餐饮",
    accountId: null,
    description: "",
    tags: [],
    frequency: "daily",
    startDate: "2026-02-30",
    isPaused: false,
  };
  expect(
    ledgerSchema.safeParse({ ...EMPTY_LEDGER, recurringRules: [rule] }).success,
  ).toBe(false);
  expect(
    ledgerSchema.safeParse({
      ...EMPTY_LEDGER,
      budgets: [
        { id: "budget", month: "2026-13", category: null, amount: 100 },
      ],
    }).success,
  ).toBe(false);
});
it("refuses malformed duplicate references without mutating the ledger", () => {
  const ledger = legacyGroup();
  ledger.records[0].duplicateOf = "C";
  expect(() => deleteEntry(ledger, "B")).toThrow("循环");
  expect(ledger.records.some((record) => record.isDeleted)).toBe(false);
});
