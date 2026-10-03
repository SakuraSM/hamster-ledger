import { describe, it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  saveEntry,
  deleteEntry,
  restoreEntry,
  summarize,
  cycleRange,
  saveBudget,
  budgetProgress,
  saveRecurring,
  applyRecurring,
  reportGroups,
  type EntryInput,
  type RecurringRule,
} from "@hamster-ledger/core";
const input: EntryInput = {
  id: "test",
  date: "2026-09-20 12:00:00",
  merchant: "测试午餐",
  amount: 3000,
  kind: "支出",
  category: "餐饮",
  description: "测试数据",
  tags: ["家庭"],
  accountId: null,
  transferToAccountId: null,
};
const rule: RecurringRule = {
  id: "rent",
  name: "房租",
  merchant: "房租",
  amount: 300000,
  kind: "支出",
  category: "居住",
  accountId: null,
  description: "",
  tags: [],
  frequency: "monthly",
  startDate: "2024-01-31",
  isPaused: false,
};
describe("manual entries and deletion", () => {
  it("creates and edits a bill without counting it twice", () => {
    const book = saveEntry(EMPTY_LEDGER, input);
    const edited = saveEntry(book, { ...input, amount: 4000, kind: "收入" });
    expect(edited.records).toHaveLength(1);
    expect(summarize(edited.records)).toEqual({
      income: 4000,
      expense: 0,
      net: 4000,
    });
    expect(edited.records[0].tags).toEqual(["家庭"]);
  });
  it("rejects invalid financial and date inputs", () => {
    for (const patch of [
      { amount: 0 },
      { amount: 1.5 },
      { date: "2026-02-30 12:00:00" },
      { date: "2026-09-20 25:00:00" },
      { kind: "转账" as const },
    ])
      expect(() => saveEntry(EMPTY_LEDGER, { ...input, ...patch })).toThrow();
  });
  it("deletes and restores an entire linked group without resurrecting duplicate amounts", () => {
    const book = saveEntry(EMPTY_LEDGER, input);
    book.records.push({
      ...book.records[0],
      id: "duplicate",
      status: "duplicate",
      duplicateOf: "test",
    });
    const removed = deleteEntry(book, "duplicate");
    expect(summarize(removed.records).expense).toBe(0);
    expect(removed.records.every((record) => record.isDeleted)).toBe(true);
    expect(summarize(restoreEntry(removed, "test").records).expense).toBe(3000);
  });
  it("requires pending duplicate review to be resolved before deletion", () => {
    const book = saveEntry(EMPTY_LEDGER, input);
    book.reviews = [
      {
        id: "review",
        leftId: "test",
        rightId: "other",
        state: "pending",
        reasons: [],
      },
    ];
    expect(() => deleteEntry(book, "test")).toThrow("核对");
  });
});
describe("budgets and recurring dates", () => {
  it("clamps cycle boundaries to month end and handles leap years", () => {
    expect(cycleRange("2024-02", 31)).toEqual({
      start: "2024-02-29",
      end: "2024-03-31",
    });
  });
  it("counts net expenses inside the configured cycle only", () => {
    let book = saveEntry(EMPTY_LEDGER, input);
    book = saveEntry(book, {
      ...input,
      id: "refund",
      kind: "退款",
      amount: 500,
    });
    book = saveEntry(book, {
      ...input,
      id: "earlier",
      date: "2026-09-01 00:00:00",
    });
    book.preferences = {
      cycleStartDay: 15,
      hideAmounts: false,
      theme: "warm",
      reminderTime: "21:00",
      reminderEnabled: false,
    };
    book = saveBudget(book, {
      id: "total",
      month: "2026-09",
      category: null,
      amount: 5000,
    });
    expect(budgetProgress(book, "2026-09")[0]).toMatchObject({
      spent: 2500,
      remaining: 2500,
      ratio: 0.5,
    });
  });
  it("generates month-end occurrences idempotently and never recreates deleted entries", () => {
    const initial = saveRecurring(EMPTY_LEDGER, rule);
    const applied = applyRecurring(initial, "2024-03-31");
    expect(applied.records.map((record) => record.date.slice(0, 10))).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
    ]);
    expect(applyRecurring(applied, "2024-03-31")).toBe(applied);
    const removed = deleteEntry(applied, applied.records[1].id);
    expect(applyRecurring(removed, "2024-03-31")).toBe(removed);
  });
  it("honors pauses, end dates, yearly leap days and transfer accounts", () => {
    expect(
      applyRecurring(
        saveRecurring(EMPTY_LEDGER, { ...rule, isPaused: true }),
        "2024-04-30",
      ).records,
    ).toHaveLength(0);
    const book = saveRecurring(EMPTY_LEDGER, {
      ...rule,
      startDate: "2024-02-29",
      endDate: "2025-12-31",
      frequency: "yearly",
    });
    expect(
      applyRecurring(book, "2026-03-01").records.map((record) =>
        record.date.slice(0, 10),
      ),
    ).toEqual(["2024-02-29", "2025-02-28"]);
    expect(() =>
      saveRecurring(EMPTY_LEDGER, {
        ...rule,
        kind: "转账",
        accountId: "a",
        transferToAccountId: "b",
      }),
    ).toThrow("账户");
  });
  it("shows refunds as negative category amounts and counts each tag explicitly", () => {
    const book = saveEntry(EMPTY_LEDGER, {
      ...input,
      kind: "退款",
      tags: ["家庭", "旅行"],
    });
    expect(
      reportGroups({
        records: book.records,
        dimension: "category",
        kind: "支出",
      }),
    ).toEqual([{ name: "餐饮", amount: -3000 }]);
    expect(
      reportGroups({ records: book.records, dimension: "tag", kind: "支出" }),
    ).toHaveLength(2);
  });
});
it("maps days before a custom cycle start into the previous period", async () => {
  const { cycleMonthForDate } = await import("@hamster-ledger/core");
  expect(cycleMonthForDate("2026-09-01 12:00:00", 15)).toBe("2026-08");
  expect(cycleMonthForDate("2024-02-29", 31)).toBe("2024-02");
});
it("renames categories across records, budgets, merchant rules and recurring rules", async () => {
  const { saveCategory, categoryNames } = await import("@hamster-ledger/core");
  let book = saveEntry(EMPTY_LEDGER, input);
  book = {
    ...book,
    rules: { 午餐: "餐饮" },
    budgets: [
      { id: "food", month: "2026-09", category: "餐饮", amount: 10000 },
    ],
    recurringRules: [{ ...rule, category: "餐饮" }],
  };
  const renamed = saveCategory(book, {
    id: "builtin:餐饮",
    name: "吃饭",
    kind: "支出",
    order: 1,
  });
  expect(renamed.records[0].category).toBe("吃饭");
  expect(renamed.rules.午餐).toBe("吃饭");
  expect(renamed.budgets?.[0].category).toBe("吃饭");
  expect(renamed.recurringRules?.[0].category).toBe("吃饭");
  expect(categoryNames(renamed)).not.toContain("餐饮");
});
it("rejects backups containing duplicate record identities", async () => {
  const { ledgerSchema } = await import("@hamster-ledger/core");
  const book = saveEntry(EMPTY_LEDGER, input);
  expect(() =>
    ledgerSchema.parse({
      ...book,
      records: [book.records[0], book.records[0]],
    }),
  ).toThrow("ID");
});
