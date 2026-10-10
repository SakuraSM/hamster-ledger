import { addMinor } from "./currency.js";
import { type Ledger } from "./model.js";
import { type LedgerNotification } from "./finance-model.js";
import { addDays, calendarDate } from "./periods.js";
import { budgetProgress, applyRecurring } from "./planning.js";
import { applySubscriptions } from "./subscriptions.js";
import { debtRemaining } from "./debts-goals.js";
import type { ExchangeRate } from "./currency.js";
export function updateNotifications(ledger: Ledger, today: string): Ledger {
  const notifications = [...(ledger.notifications ?? [])];
  function add(input: Omit<LedgerNotification, "isRead">): void {
    if (!notifications.some((item) => item.id === input.id))
      notifications.push({ ...input, isRead: false });
  }
  for (const subscription of ledger.subscriptions ?? []) {
    if (
      subscription.isArchived ||
      ["canceled", "paused"].includes(subscription.status)
    )
      continue;
    const due =
      subscription.status === "trial"
        ? subscription.trialEnd
        : subscription.nextDate;
    if (
      subscription.autoPost &&
      subscription.status === "active" &&
      subscription.nextDate <= today
    )
      add({
        id: `subscription-blocked:${subscription.id}:${subscription.nextDate}`,
        title: "自动记账待处理",
        body: `${subscription.name} · ${subscription.nextDate} 尚未入账，请检查扣费账户及当期汇率。`,
        date: today,
        entityId: subscription.id,
      });
    if (due && due <= addDays(today, subscription.reminderDays))
      add({
        id: `subscription:${subscription.id}:${due}`,
        title:
          subscription.status === "trial" ? "订阅试用即将结束" : "订阅扣费提醒",
        body: `${subscription.name} · ${due}`,
        date: today,
        entityId: subscription.id,
      });
  }
  for (const debt of ledger.debts ?? [])
    if (
      !debt.isArchived &&
      debt.dueDate &&
      debt.dueDate <= addDays(today, 3) &&
      debtRemaining(ledger, debt) > 0
    )
      add({
        id: `debt:${debt.id}:${debt.dueDate}`,
        title: debt.dueDate < today ? "借贷已逾期" : "借贷即将到期",
        body: `${debt.name} · ${debt.dueDate}`,
        date: today,
        entityId: debt.id,
      });
  for (const goal of ledger.goals ?? []) {
    if (goal.isArchived) continue;
    const complete =
      goal.allocations.reduce((sum, item) => addMinor(sum, item.amount), 0) >=
      goal.target;
    if (complete || (goal.dueDate && goal.dueDate <= addDays(today, 7)))
      add({
        id: `goal:${goal.id}:${complete ? "complete" : goal.dueDate}`,
        title: complete ? "储蓄目标已达成" : "储蓄目标临近截止",
        body: goal.name,
        date: today,
        entityId: goal.id,
      });
  }
  for (const budget of budgetProgress(ledger, today.slice(0, 7)))
    if (budget.ratio * 100 >= (budget.alertPercent ?? 80))
      add({
        id: `budget:${budget.id}:${budget.start}:${budget.ratio >= 1 ? "over" : "warning"}`,
        title: budget.ratio >= 1 ? "预算已超支" : "预算使用提醒",
        body: `${budget.category ?? "总预算"}已使用 ${Math.round(budget.ratio * 100)}%`,
        date: today,
        entityId: budget.id,
      });
  for (const account of ledger.accounts)
    if (
      !account.isArchived &&
      account.type === "信用卡" &&
      account.paymentDay
    ) {
      const [year, month] = today.split("-").map(Number);
      const due = calendarDate({
        year,
        month: month - 1,
        day: account.paymentDay,
      });
      if (due >= today && due <= addDays(today, 3))
        add({
          id: `credit:${account.id}:${due}`,
          title: "信用卡还款日提醒",
          body: `${account.name} · ${due}，请核对银行账单`,
          date: today,
          entityId: account.id,
        });
    }
  return notifications.length === (ledger.notifications?.length ?? 0)
    ? ledger
    : { ...ledger, notifications };
}
export function applyPlanning(input: {
  ledger: Ledger;
  today: string;
  rates?: ExchangeRate[];
}): Ledger {
  return updateNotifications(
    applySubscriptions({
      ...input,
      ledger: applyRecurring(input.ledger, input.today, 50),
    }),
    input.today,
  );
}
