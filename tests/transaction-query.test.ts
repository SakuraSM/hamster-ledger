import { expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  createTransactionIndex,
  queryTransactions,
  summarize,
  normalizeLegacyRecord,
  UNASSIGNED_ACCOUNT_FILTER,
  type BillRecord,
} from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";

function record(id: string, changes: Partial<BillRecord> = {}): BillRecord {
  return {
    ...createDemoLedger().records[0],
    id,
    date: "2026-10-15 12:00:00",
    amount: 3600,
    kind: "支出",
    status: "confirmed",
    category: "餐饮",
    account: "测试银行卡",
    source: "支付宝",
    linkedSources: ["招商银行"],
    tags: ["午餐"],
    ...changes,
  };
}
const ledger = {
  ...EMPTY_LEDGER,
  records: [
    record("first", { date: "2026-10-15 00:00:00" }),
    record("last", { date: "2026-10-15 23:59:59" }),
    record("next", { date: "2026-10-16 00:00:00" }),
    record("pending", { status: "pending" }),
    record("duplicate", { status: "duplicate" }),
    record("deleted", { isDeleted: true }),
    record("refund", { kind: "退款", amount: 600 }),
    record("income", { kind: "收入", amount: 10000 }),
    record("transfer", { kind: "转账", amount: 100000 }),
  ],
};
const index = createTransactionIndex(ledger.records, ledger.accounts);
it("combines inclusive dates, linked source, category, kind and search", () => {
  const result = queryTransactions(ledger, index, {
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    source: "招商银行",
    query: "  午餐  ",
    category: "餐饮",
    kind: "支出",
    status: "confirmed",
  });
  expect(result.error).toBe("");
  expect(result.records.map((item) => item.id)).toEqual(["last", "first"]);
  expect(
    queryTransactions(ledger, index, { query: "测试银行卡" }).records,
  ).toHaveLength(7);
});
it("keeps pending and duplicate rows out of confirmed financial totals", () => {
  const active = queryTransactions(ledger, index, {}).records;
  expect(active.map((item) => item.id)).not.toContain("duplicate");
  expect(summarize(active)).toEqual({
    expense: 10200,
    income: 10000,
    net: -200,
  });
  const trash = queryTransactions(ledger, index, { isDeleted: true }).records;
  expect(trash.map((item) => item.id)).toEqual(["deleted"]);
  expect(summarize(trash)).toEqual({ expense: 0, income: 0, net: 0 });
  expect(
    queryTransactions(ledger, index, { status: "duplicate" }).records.map(
      (item) => item.id,
    ),
  ).toEqual(["duplicate"]);
});
it.each([
  { startDate: "2026-02-30" },
  { endDate: "2026-13-01" },
  { startDate: "2026-10-16", endDate: "2026-10-15" },
])(
  "rejects an invalid date range without showing a misleading total",
  (filter) => {
    expect(queryTransactions(ledger, index, filter)).toMatchObject({
      records: [],
      error: expect.any(String),
    });
    expect(queryTransactions(ledger, index, filter).error).not.toBe("");
  },
);
it("recognizes aliases, explicit unassignment, transfer destinations and movement accounts", () => {
  const account = {
    ...createDemoLedger().accounts[0],
    id: "cash",
    name: "现金",
    aliases: ["测试银行卡"],
    currency: "CNY" as const,
  };
  const records = [
    record("alias"),
    record("unassigned", { accountId: null }),
    record("transfer", { accountId: "elsewhere", transferToAccountId: "cash" }),
    record("movement", {
      accountId: null,
      detail: {
        ...normalizeLegacyRecord(record("movement")).detail!,
        movements: [{ accountId: "cash", amount: -3600 }],
      },
    }),
  ];
  const withAccounts = { ...EMPTY_LEDGER, accounts: [account], records };
  const indexed = createTransactionIndex(records, withAccounts.accounts);
  expect(
    queryTransactions(withAccounts, indexed, { accountId: "cash" }).records.map(
      (item) => item.id,
    ),
  ).toEqual(["alias", "transfer", "movement"]);
  expect(
    queryTransactions(withAccounts, indexed, {
      accountId: UNASSIGNED_ACCOUNT_FILTER,
    }).records.map((item) => item.id),
  ).toEqual(["unassigned"]);
});
