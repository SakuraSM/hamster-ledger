import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  applySubscriptions,
  saveSubscription,
  nextSubscriptionDate,
  skipSubscription,
  subscriptionCost,
  createDebt,
  settleDebt,
  debtRemaining,
  saveGoal,
  budgetProgress,
  saveBudget,
  updateNotifications,
  saveAdvancedEntry,
  summarize,
  summarizeAssets,
  saveAssetAccount,
  validateFinancialIntegrity,
  type Ledger,
  type AssetAccount,
  type Subscription,
  type Debt,
  type ExchangeRate,
} from "@hamster-ledger/core";
const rate: ExchangeRate = {
  currency: "CNY",
  rate: "1",
  date: "2024-01-01",
  source: "manual",
};
const account = (
  id: string,
  type: AssetAccount["type"] = "银行卡",
): AssetAccount => ({
  id,
  name: id,
  type,
  kind: type === "应付款" ? "liability" : "asset",
  openingBalance: 0,
  balanceAt: "2024-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
  currency: "CNY",
});
const ledger = (): Ledger => ({
  ...EMPTY_LEDGER,
  accounts: [
    account("cash"),
    account("receivable", "应收款"),
    account("payable", "应付款"),
  ],
});
const subscription: Subscription = {
  id: "monthly",
  name: "虚拟订阅",
  amount: 1500,
  currency: "CNY",
  accountId: "cash",
  category: "娱乐",
  cycle: "monthly",
  interval: 1,
  anchorDay: 31,
  nextDate: "2024-01-31",
  status: "active",
  autoPost: true,
  reminderDays: 3,
  skippedDates: [],
  isArchived: false,
};
const debt: Debt = {
  id: "loan",
  name: "虚拟借款",
  direction: "receivable",
  currency: "CNY",
  principal: 10000,
  accountId: "cash",
  counterAccountId: "receivable",
  openedOn: "2024-01-01",
  dueDate: "2024-04-01",
  isArchived: false,
};
describe("subscription dates and replay", () => {
  it("anchors month-end and leap years, honors interval and skips exactly one occurrence", () => {
    expect(nextSubscriptionDate(subscription)).toBe("2024-02-29");
    expect(
      nextSubscriptionDate({ ...subscription, nextDate: "2024-02-29" }),
    ).toBe("2024-03-31");
    expect(
      nextSubscriptionDate({
        ...subscription,
        cycle: "quarterly",
        interval: 2,
      }),
    ).toBe("2024-07-31");
    expect(
      nextSubscriptionDate({ ...subscription, cycle: "weekly", interval: 2 }),
    ).toBe("2024-02-14");
    const skipped = skipSubscription(
      saveSubscription(ledger(), subscription),
      subscription.id,
    );
    const applied = applySubscriptions({
      ledger: skipped,
      today: "2024-03-31",
    });
    expect(applied.records.map((record) => record.date.slice(0, 10))).toEqual([
      "2024-02-29",
      "2024-03-31",
    ]);
    expect(applySubscriptions({ ledger: applied, today: "2024-03-31" })).toBe(
      applied,
    );
    expect(subscriptionCost(subscription)).toEqual({
      monthly: 1500,
      annual: 18000,
    });
  });
  it("defaults to reminders, keeps paused/trial/canceled history and batches catchup", () => {
    for (const patch of [
      { autoPost: false },
      { status: "paused" as const },
      { status: "canceled" as const },
      { isArchived: true },
      { status: "trial" as const, trialEnd: "2024-04-01" },
    ]) {
      const book = saveSubscription(ledger(), { ...subscription, ...patch });
      expect(
        applySubscriptions({ ledger: book, today: "2024-03-31" }).records,
      ).toHaveLength(0);
    }
    const old = saveSubscription(ledger(), {
      ...subscription,
      nextDate: "2000-01-31",
    });
    const batch = applySubscriptions({ ledger: old, today: "2024-03-31" });
    expect(batch.records).toHaveLength(50);
    const second = applySubscriptions({ ledger: batch, today: "2024-03-31" });
    expect(second.records).toHaveLength(100);
    const tombstone = {
      ...batch,
      records: batch.records.map((record, index) =>
        index === 0 ? { ...record, isDeleted: true } : record,
      ),
    };
    expect(
      applySubscriptions({
        ledger: tombstone,
        today: "2004-02-29",
      }).records.filter((record) => !record.isDeleted),
    ).toHaveLength(49);
  });
  it("requires a quote for each foreign charge date and preserves snapshots", () => {
    const book = saveSubscription(
      { ...ledger(), accounts: [{ ...account("cash"), currency: "USD" }] },
      { ...subscription, currency: "USD" },
    );
    expect(
      applySubscriptions({ ledger: book, today: "2024-02-29" }).records,
    ).toHaveLength(0);
    const applied = applySubscriptions({
      ledger: book,
      today: "2024-02-29",
      rates: [
        {
          currency: "USD",
          rate: "7.1",
          date: "2024-01-30",
          requestedDate: "2024-01-31",
          source: "frankfurter",
        },
      ],
    });
    expect(applied.records).toHaveLength(1);
    expect(applied.records[0].amount).toBe(10650);
    expect(applied.subscriptions?.[0].nextDate).toBe("2024-02-29");
    expect(applied.records[0].detail?.original.date).toBe("2024-01-30");
  });
});
describe("loans, goals and reminders", () => {
  it("keeps loan principal neutral and handles partial repayment plus separate interest", () => {
    const opened = createDebt({ ledger: ledger(), debt, rate });
    const paid = settleDebt({
      ledger: opened,
      debtId: debt.id,
      amount: 4000,
      interest: 200,
      rate,
      date: "2024-02-01",
      id: "repayment",
    });
    expect(debtRemaining(paid, debt)).toBe(6000);
    expect(summarize(paid.records)).toEqual({
      expense: 0,
      income: 200,
      net: 200,
    });
    expect(
      summarizeAssets({ ledger: paid, through: "2024-02-02 00:00:00" })
        .netAssets,
    ).toBe(200);
    expect(() =>
      settleDebt({
        ledger: paid,
        debtId: debt.id,
        amount: 7000,
        rate,
        date: "2024-02-02",
        id: "too-much",
      }),
    ).toThrow("剩余本金");
    expect(() =>
      settleDebt({
        ledger: paid,
        debtId: debt.id,
        amount: 4000,
        rate,
        date: "2024-02-01",
        id: "repayment",
      }),
    ).toThrow("已记录");
    validateFinancialIntegrity(paid);
    expect(() =>
      validateFinancialIntegrity({
        ...paid,
        records: paid.records.filter(
          (record) => record.id !== "debt:loan:principal",
        ),
      }),
    ).toThrow("本金");
  });
  it("tracks borrowed principal and treats outgoing interest as expense", () => {
    const borrowed = {
      ...debt,
      direction: "payable" as const,
      counterAccountId: "payable",
    };
    const book = createDebt({ ledger: ledger(), debt: borrowed, rate });
    const paid = settleDebt({
      ledger: book,
      debtId: debt.id,
      amount: 10000,
      interest: 300,
      rate,
      date: "2024-02-01",
      id: "paid",
    });
    expect(debtRemaining(paid, borrowed)).toBe(0);
    expect(summarize(paid.records).expense).toBe(300);
    expect(
      summarizeAssets({ ledger: paid, through: "2024-02-02 00:00:00" })
        .liabilities,
    ).toBe(300);
  });
  it("allocations change goal progress without inventing income or expense and notifications deduplicate", () => {
    const book = saveGoal(ledger(), {
      id: "goal",
      name: "虚拟旅行",
      target: 10000,
      dueDate: "2024-04-01",
      accountId: null,
      isArchived: false,
      allocations: [{ id: "allocation", amount: 10000, date: "2024-03-01" }],
    });
    expect(book.records).toHaveLength(0);
    const notified = updateNotifications(book, "2024-03-30");
    expect(notified.notifications).toHaveLength(1);
    expect(updateNotifications(notified, "2024-03-31")).toBe(notified);
    expect(() =>
      saveGoal(book, {
        ...book.goals![0],
        allocations: [{ id: "minus", amount: -1, date: "2024-03-01" }],
      }),
    ).toThrow("取出");
    expect(() =>
      saveGoal(book, {
        ...book.goals![0],
        allocations: [
          {
            id: "unknown",
            amount: 100,
            date: "2024-03-01",
            recordId: "missing",
          },
        ],
      }),
    ).toThrow("实际转账");
  });
});
describe("budget periods and valuations", () => {
  it("rolls positive unused monthly funds forward and keeps quarter/year scopes separate", () => {
    let book = ledger();
    book = saveAdvancedEntry(book, {
      id: "food",
      date: "2024-01-15 12:00:00",
      merchant: "虚拟午餐",
      category: "餐饮",
      accountId: "cash",
      detail: {
        type: "expense",
        original: { ...rate, minor: 2000 },
        origin: "manual",
        splits: [],
        attachmentIds: [],
        movements: [],
      },
    });
    book = saveBudget(book, {
      id: "jan",
      month: "2024-01",
      amount: 5000,
      category: null,
    });
    book = saveBudget(book, {
      id: "feb",
      month: "2024-02",
      amount: 5000,
      category: null,
      rollover: true,
    });
    book = saveBudget(book, {
      id: "quarter",
      month: "2024-02",
      amount: 20000,
      category: null,
      period: "quarterly",
    });
    book = saveBudget(book, {
      id: "annual",
      month: "2024-02",
      amount: 100000,
      category: null,
      period: "yearly",
    });
    const feb = budgetProgress(book, "2024-02");
    expect(feb.find((item) => item.id === "feb")).toMatchObject({
      available: 8000,
      carried: 3000,
      remaining: 8000,
    });
    expect(feb.find((item) => item.id === "quarter")).toMatchObject({
      start: "2024-01-01",
      end: "2024-04-01",
      spent: 2000,
    });
    expect(budgetProgress(book, "2024-04").map((item) => item.id)).toEqual([
      "annual",
    ]);
  });
  it("does not sum foreign minor units as CNY and uses historical balance checkpoints", () => {
    const usd = {
      ...account("usd"),
      currency: "USD" as const,
      openingBalance: 10000,
    };
    let book: Ledger = saveAssetAccount({
      ledger: { ...ledger(), accounts: [] },
      account: usd,
      now: "2024-01-01 12:00:00",
      checkpointId: "initial",
      note: "初始",
    });
    expect(
      summarizeAssets({ ledger: book, through: "2024-02-01 00:00:00" }),
    ).toMatchObject({ netAssets: 0, missingCurrencies: ["USD"] });
    expect(
      summarizeAssets({
        ledger: book,
        through: "2024-02-01 00:00:00",
        rates: [
          { currency: "USD", date: "2024-02-01", rate: "7", source: "manual" },
        ],
      }).netAssets,
    ).toBe(70000);
    book = saveAssetAccount({
      ledger: book,
      account: {
        ...usd,
        openingBalance: 20000,
        balanceAt: "2024-03-01 00:00:00",
        checkpoints: [
          {
            id: "before",
            balance: 10000,
            at: usd.balanceAt,
            recordedAt: usd.balanceAt,
            note: "测试",
          },
        ],
      },
      now: "2024-03-01 12:00:00",
      checkpointId: "after",
      note: "估值",
    });
    expect(
      summarizeAssets({
        ledger: book,
        through: "2024-02-01 00:00:00",
        rates: [
          { currency: "USD", date: "2024-02-01", rate: "7", source: "manual" },
        ],
      }).netAssets,
    ).toBe(70000);
    expect(
      summarizeAssets({
        ledger: book,
        through: "2024-03-02 00:00:00",
        rates: [
          { currency: "USD", date: "2024-03-02", rate: "7", source: "manual" },
        ],
      }).netAssets,
    ).toBe(140000);
    // A date before the first checkpoint has no invented balance.
    expect(
      summarizeAssets({
        ledger: book,
        through: "2023-12-31 23:59:59",
        rates: [
          { currency: "USD", date: "2023-12-31", rate: "7", source: "manual" },
        ],
      }).netAssets,
    ).toBe(0);
  });
});
