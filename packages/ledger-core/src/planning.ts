const DATE_KEY_LENGTH = 10;
const DAYS_PER_WEEK = 7;
const MAX_OCCURRENCES = 10000;
import { type Ledger, type BillRecord, summarize } from "./model.js";
import {
  budgetSchema,
  recurringRuleSchema,
  type Budget,
  type RecurringRule,
} from "./planning-model.js";
import { addDays, calendarDate, cycleRange, isValidDate } from "./periods.js";
export function periodRecords(ledger: Ledger, month: string): BillRecord[] {
  const range = cycleRange(month, ledger.preferences?.cycleStartDay ?? 1);
  return ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.date.slice(0, DATE_KEY_LENGTH) >= range.start &&
      record.date.slice(0, DATE_KEY_LENGTH) < range.end,
  );
}
export function budgetProgress(
  ledger: Ledger,
  month: string,
): Array<Budget & { spent: number; remaining: number; ratio: number }> {
  const records = periodRecords(ledger, month);
  return (ledger.budgets ?? [])
    .filter((budget) => budget.month === month)
    .map((budget) => {
      const spent = Math.max(
        0,
        summarize(
          records.filter(
            (record) =>
              budget.category === null || record.category === budget.category,
          ),
        ).expense,
      );
      return {
        ...budget,
        spent,
        remaining: budget.amount - spent,
        ratio: spent / budget.amount,
      };
    });
}
export function saveBudget(ledger: Ledger, input: Budget): Ledger {
  const budget = budgetSchema.parse(input);
  return {
    ...ledger,
    budgets: [
      ...(ledger.budgets ?? []).filter(
        (item) =>
          item.id !== budget.id &&
          (item.month !== budget.month || item.category !== budget.category),
      ),
      budget,
    ],
  };
}
function occurrence(rule: RecurringRule, index: number): string {
  if (rule.frequency === "daily" || rule.frequency === "weekly")
    return addDays(
      rule.startDate,
      index * (rule.frequency === "weekly" ? DAYS_PER_WEEK : 1),
    );
  const [year, month, day] = rule.startDate.split("-").map(Number);
  return calendarDate({
    year: year + (rule.frequency === "yearly" ? index : 0),
    month: month - 1 + (rule.frequency === "monthly" ? index : 0),
    day,
  });
}
export function applyRecurring(ledger: Ledger, today: string): Ledger {
  if (!isValidDate(today)) throw new Error("周期记账日期无效。");
  const ids = new Set(ledger.records.map((record) => record.id));
  const added: BillRecord[] = [];
  for (const rule of ledger.recurringRules ?? []) {
    if (rule.isPaused) continue;
    let index = 0;
    while (index < MAX_OCCURRENCES) {
      const date = occurrence(rule, index++);
      if (date > today || (rule.endDate && date > rule.endDate)) break;
      const id = `recurring:${rule.id}:${date}`;
      if (ids.has(id)) continue;
      if (
        [rule.accountId, rule.transferToAccountId].some(
          (id) =>
            id &&
            !ledger.accounts.some(
              (account) => account.id === id && !account.isArchived,
            ),
        )
      )
        continue;
      added.push({
        id,
        date: date + " 00:00:00",
        merchant: rule.merchant,
        description: rule.description,
        amount: rule.amount,
        currency: "CNY",
        kind: rule.kind,
        category: rule.category,
        source: "周期记账",
        account:
          ledger.accounts.find((account) => account.id === rule.accountId)
            ?.name ?? "",
        accountId: rule.accountId,
        transferToAccountId: rule.transferToAccountId,
        orderId: id,
        status: "confirmed",
        sourceStatus: "周期规则生成",
        fileName: rule.name,
        raw: { 规则: rule.name },
        linkedSources: [],
        tags: rule.tags,
        recurringRuleId: rule.id,
      });
      ids.add(id);
    }
    if (index >= MAX_OCCURRENCES)
      throw new Error("周期规则跨度过大，请缩短开始日期。");
  }
  return added.length
    ? { ...ledger, records: [...ledger.records, ...added] }
    : ledger;
}
export function saveRecurring(ledger: Ledger, input: RecurringRule): Ledger {
  const rule = recurringRuleSchema.parse(input);
  if (
    !isValidDate(rule.startDate) ||
    (rule.endDate &&
      (!isValidDate(rule.endDate) || rule.endDate < rule.startDate))
  )
    throw new Error("周期日期范围无效。");
  if (
    rule.kind === "转账" &&
    (!rule.accountId ||
      !rule.transferToAccountId ||
      rule.accountId === rule.transferToAccountId)
  )
    throw new Error("周期转账需要两个不同账户。");
  if (
    [rule.accountId, rule.transferToAccountId].some(
      (id) =>
        id &&
        !ledger.accounts.some(
          (account) => account.id === id && !account.isArchived,
        ),
    )
  )
    throw new Error("周期规则的账户不存在或已归档。");
  return {
    ...ledger,
    recurringRules: [
      ...(ledger.recurringRules ?? []).filter((item) => item.id !== rule.id),
      rule,
    ],
  };
}
