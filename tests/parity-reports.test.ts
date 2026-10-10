import { describe, it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  migrateLedger,
  saveAdvancedEntry,
  memberExpenses,
  categoryBreakdown,
  calendarHeat,
  netWorthDates,
  netWorthSeries,
  batchRecords,
  matchesFinanceFilters,
  reimbursementState,
  saveCategory,
  type Ledger,
  type AdvancedEntryInput,
} from "@hamster-ledger/core";
function base(): Ledger {
  return migrateLedger({
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name: "虚拟账户",
        kind: "asset",
        type: "银行卡",
        openingBalance: 100000,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        checkpoints: [],
        isArchived: false,
      },
    ],
  });
}
function entry(
  id: string,
  amount: number,
  type: "expense" | "reimburse" | "aa_settlement" = "expense",
): AdvancedEntryInput {
  return {
    id,
    date: "2026-10-03 12:00:00",
    merchant: "虚拟午餐",
    accountId: "cash",
    category: "餐饮",
    detail: {
      type,
      original: {
        currency: "CNY",
        minor: amount,
        rate: "1",
        date: "2026-10-03",
        source: "manual",
      },
      memberId: "alice",
      splits:
        type === "expense"
          ? [
              { memberId: "alice", amount: Math.ceil(amount / 2) },
              { memberId: "bob", amount: Math.floor(amount / 2) },
            ]
          : [],
      attachmentIds: [],
      movements: [],
      origin: "manual",
      isReimbursable: type === "expense",
      relatedId: type === "reimburse" ? "bill" : undefined,
    },
  };
}
describe("extended reports and atomic batch editing", () => {
  it("subtracts a partial reimbursement from the original shares and preserves the household total", () => {
    let ledger = saveAdvancedEntry(base(), entry("bill", 10001));
    ledger = saveAdvancedEntry(ledger, entry("return", 2001, "reimburse"));
    expect(memberExpenses(ledger, ledger.records)).toEqual([
      { memberId: "alice", amount: 4000 },
      { memberId: "bob", amount: 4000 },
    ]);
    expect(reimbursementState(ledger, ledger.records[0])).toBe("partial");
    expect(
      matchesFinanceFilters(ledger, ledger.records[0], {
        memberId: "bob",
        reimbursement: "partial",
        accountId: "cash",
      }),
    ).toBe(true);
    expect(
      memberExpenses(ledger, [ledger.records[1]]).reduce(
        (sum, item) => sum + item.amount,
        0,
      ),
    ).toBe(-2001);
  });
  it("aggregates parent categories and drills down without double counting", () => {
    let ledger = saveCategory(base(), {
      id: "family",
      name: "家庭",
      kind: "支出",
      order: 20,
    });
    ledger = saveCategory(ledger, {
      id: "food",
      name: "虚拟饮食",
      kind: "支出",
      order: 21,
      parentId: "family",
    });
    ledger = saveAdvancedEntry(ledger, {
      ...entry("bill", 10001),
      category: "虚拟饮食",
    });
    expect(
      categoryBreakdown({ ledger, records: ledger.records, kind: "支出" }),
    ).toEqual([
      { id: "family", name: "家庭", amount: 10001, hasChildren: true },
    ]);
    expect(
      categoryBreakdown({
        ledger,
        records: ledger.records,
        kind: "支出",
        parentId: "family",
      })[0],
    ).toMatchObject({ id: "food", amount: 10001, hasChildren: false });
    expect(calendarHeat(ledger, "2026-10")[2]).toMatchObject({
      date: "2026-10-03",
      expense: 10001,
      count: 1,
      level: 4,
    });
  });
  it("uses month ends, explicit baselines, historical FX and gaps when FX is missing", () => {
    expect(netWorthDates("2024-01-31", "2024-03-05")).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-05",
    ]);
    const ledger = base();
    ledger.accounts[0].currency = "USD";
    const dates = ["2026-01-01", "2026-02-28", "2026-03-31"];
    const series = netWorthSeries(ledger, dates, {
      "2026-01-01": [
        {
          currency: "USD",
          rate: "7",
          date: "2025-12-31",
          source: "frankfurter",
        },
      ],
      "2026-02-28": [
        {
          currency: "USD",
          rate: "8",
          date: "2026-02-27",
          source: "frankfurter",
        },
      ],
    });
    expect(series.map((item) => item.amount)).toEqual([700000, 800000, null]);
  });
  it("validates all selected snapshots and financial links before applying any batch", () => {
    let ledger = saveAdvancedEntry(base(), entry("bill", 10001));
    const changed = batchRecords(ledger, {
      records: ledger.records,
      action: "category",
      category: "购物",
    });
    expect(changed.records[0].category).toBe("购物");
    expect(() =>
      batchRecords(changed, { records: ledger.records, action: "delete" }),
    ).toThrow("发生变化");
    ledger = saveAdvancedEntry(ledger, entry("return", 2001, "reimburse"));
    expect(() =>
      batchRecords(ledger, { records: [ledger.records[0]], action: "delete" }),
    ).toThrow("回款");
    expect(
      batchRecords(ledger, {
        records: ledger.records,
        action: "delete",
      }).records.every((item) => item.isDeleted),
    ).toBe(true);
    expect(ledger.records.every((item) => !item.isDeleted)).toBe(true);
  });
});
