import type { Budget } from "./planning-model.js";
import { budgetSchema } from "./planning-model.js";
import { summarize, type Ledger } from "./model.js";
import { cycleRange, calendarDate } from "./periods.js";
import { categoryDefinitions } from "./categories.js";
export const BUDGET_PERIODS = {
  monthly: "月度",
  quarterly: "季度",
  yearly: "年度",
} as const;
export function budgetRange(
  ledger: Ledger,
  budget: Budget,
): { start: string; end: string } {
  const [year, month] = budget.month.split("-").map(Number);
  const span =
    budget.period === "yearly" ? 12 : budget.period === "quarterly" ? 3 : 1;
  const firstMonth = Math.floor((month - 1) / span) * span;
  const startMonth = calendarDate({ year, month: firstMonth, day: 1 }).slice(
    0,
    7,
  );
  const endMonth = calendarDate({
    year,
    month: firstMonth + span,
    day: 1,
  }).slice(0, 7);
  const day = ledger.preferences?.cycleStartDay ?? 1;
  return {
    start: cycleRange(startMonth, day).start,
    end: cycleRange(endMonth, day).start,
  };
}
export interface BudgetProgress extends Budget {
  spent: number;
  remaining: number;
  ratio: number;
  available: number;
  carried: number;
  start: string;
  end: string;
}
export function budgetProgress(
  ledger: Ledger,
  month: string,
): BudgetProgress[] {
  const selected = cycleRange(
    month,
    ledger.preferences?.cycleStartDay ?? 1,
  ).start;
  const budgets = ledger.budgets ?? [];
  const categories = categoryDefinitions(ledger);
  const memo = new Map<string, BudgetProgress>();
  function progress(budget: Budget): BudgetProgress {
    const found = memo.get(budget.id);
    if (found) return found;
    const range = budgetRange(ledger, budget);
    const category = categories.find((item) => item.name === budget.category);
    const names = new Set([
      budget.category,
      ...categories
        .filter((item) => item.parentId === category?.id && category)
        .map((item) => item.name),
    ]);
    const spent = Math.max(
      0,
      summarize(
        ledger.records.filter(
          (record) =>
            record.date.slice(0, 10) >= range.start &&
            record.date.slice(0, 10) < range.end &&
            (budget.category === null || names.has(record.category)),
        ),
      ).expense,
    );
    const previous = budget.rollover
      ? budgets.find(
          (item) =>
            item.id !== budget.id &&
            item.category === budget.category &&
            (item.period ?? "monthly") === (budget.period ?? "monthly") &&
            budgetRange(ledger, item).end === range.start,
        )
      : undefined;
    const carried = previous ? Math.max(0, progress(previous).remaining) : 0;
    const available = budget.amount + carried;
    if (!Number.isSafeInteger(available) || !Number.isSafeInteger(spent))
      throw new Error("预算金额超过安全范围。");
    const result = {
      ...budget,
      ...range,
      spent,
      carried,
      available,
      remaining: available - spent,
      ratio: spent / available,
    };
    memo.set(budget.id, result);
    return result;
  }
  return budgets
    .filter((budget) => {
      const range = budgetRange(ledger, budget);
      return selected >= range.start && selected < range.end;
    })
    .map(progress);
}
export function saveBudget(ledger: Ledger, input: Budget): Ledger {
  const budget = budgetSchema.parse(input);
  const range = budgetRange(ledger, budget);
  return {
    ...ledger,
    budgets: [
      ...(ledger.budgets ?? []).filter(
        (item) =>
          item.id !== budget.id &&
          !(
            item.category === budget.category &&
            (item.period ?? "monthly") === (budget.period ?? "monthly") &&
            budgetRange(ledger, item).start === range.start
          ),
      ),
      budget,
    ],
  };
}
