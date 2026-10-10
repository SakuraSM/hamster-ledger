import { type Ledger } from "./model.js";
import { subscriptionSchema, type Subscription } from "./finance-model.js";
import { addDays, calendarDate } from "./periods.js";
import { saveAdvancedEntry } from "./advanced-entries.js";
import type { ExchangeRate } from "./currency.js";
const MONTHS = { monthly: 1, quarterly: 3, halfYearly: 6, yearly: 12 } as const;
const MONTHS_PER_YEAR = 12;
const WEEKS_PER_YEAR = 52;
const DAYS_PER_WEEK = 7;
const MAX_CATCHUP = 50;
export function nextSubscriptionDate(subscription: Subscription): string {
  if (subscription.cycle === "weekly")
    return addDays(
      subscription.nextDate,
      DAYS_PER_WEEK * subscription.interval,
    );
  const [year, month] = subscription.nextDate.split("-").map(Number);
  return calendarDate({
    year,
    month: month - 1 + MONTHS[subscription.cycle] * subscription.interval,
    day: subscription.anchorDay,
  });
}
export function subscriptionCost(subscription: Subscription): {
  monthly: number;
  annual: number;
} {
  const numerator =
    BigInt(subscription.amount) *
    BigInt(subscription.cycle === "weekly" ? WEEKS_PER_YEAR : MONTHS_PER_YEAR);
  const denominator = BigInt(
    subscription.interval *
      (subscription.cycle === "weekly" ? 1 : MONTHS[subscription.cycle]),
  );
  const annual = Number((numerator + denominator / 2n) / denominator);
  if (!Number.isSafeInteger(annual))
    throw new Error("订阅年化成本超出安全金额范围。");
  const monthlyDenominator = denominator * BigInt(MONTHS_PER_YEAR);
  return {
    monthly: Number((numerator + monthlyDenominator / 2n) / monthlyDenominator),
    annual,
  };
}
export function saveSubscription(ledger: Ledger, value: Subscription): Ledger {
  const subscription = subscriptionSchema.parse(value);
  if (
    subscription.accountId &&
    !ledger.accounts.some(
      (account) =>
        account.id === subscription.accountId &&
        (!account.isArchived ||
          subscription.isArchived ||
          ["paused", "canceled"].includes(subscription.status)) &&
        (account.currency ?? "CNY") === subscription.currency,
    )
  )
    throw new Error("请选择币种一致的有效账户。");
  if (subscription.autoPost && !subscription.accountId)
    throw new Error("自动记账必须指定扣费账户。");
  if (subscription.status === "trial" && !subscription.trialEnd)
    throw new Error("试用订阅需要试用结束日期。");
  if (
    subscription.status === "trial" &&
    subscription.trialEnd &&
    subscription.nextDate < subscription.trialEnd
  )
    subscription.nextDate = subscription.trialEnd;
  return {
    ...ledger,
    subscriptions: [
      ...(ledger.subscriptions ?? []).filter(
        (item) => item.id !== subscription.id,
      ),
      subscription,
    ],
  };
}
export function applySubscriptions(input: {
  ledger: Ledger;
  today: string;
  rates?: ExchangeRate[];
}): Ledger {
  let next = input.ledger;
  for (const original of input.ledger.subscriptions ?? []) {
    if (original.isArchived || ["paused", "canceled"].includes(original.status))
      continue;
    let subscription = original;
    if (
      subscription.status === "trial" &&
      subscription.trialEnd &&
      subscription.trialEnd <= input.today
    )
      subscription = { ...subscription, status: "active" };
    if (subscription.status === "trial" || !subscription.autoPost) {
      if (subscription !== original)
        next = saveSubscription(next, subscription);
      continue;
    }
    for (
      let count = 0;
      count < MAX_CATCHUP && subscription.nextDate <= input.today;
      count++
    ) {
      const date = subscription.nextDate,
        id = `subscription:${subscription.id}:${date}`;
      if (
        !next.records.some((record) => record.id === id) &&
        !subscription.skippedDates.includes(date)
      ) {
        const account = next.accounts.find(
          (item) => item.id === subscription.accountId && !item.isArchived,
        );
        const rate =
          subscription.currency === "CNY"
            ? {
                currency: "CNY" as const,
                rate: "1",
                date,
                source: "manual" as const,
              }
            : input.rates
                ?.filter(
                  (item) =>
                    item.currency === subscription.currency &&
                    item.date <= date &&
                    (item.requestedDate ?? item.date) === date,
                )
                .sort((left, right) => right.date.localeCompare(left.date))[0];
        if (!account || !rate) break;
        next = saveAdvancedEntry(next, {
          id,
          date: date + " 00:00:00",
          merchant: subscription.name,
          category: subscription.category,
          accountId: account.id,
          detail: {
            type: "expense",
            original: { ...rate, minor: subscription.amount },
            subscriptionId: subscription.id,
            origin: "subscription",
            attachmentIds: [],
            splits: [],
            movements: [],
          },
        });
      }
      subscription = {
        ...subscription,
        nextDate: nextSubscriptionDate(subscription),
      };
    }
    if (subscription !== original) next = saveSubscription(next, subscription);
  }
  return next;
}
export function skipSubscription(ledger: Ledger, id: string): Ledger {
  const subscription = ledger.subscriptions?.find((item) => item.id === id);
  if (!subscription) throw new Error("订阅不存在。");
  return saveSubscription(ledger, {
    ...subscription,
    skippedDates: [
      ...new Set([...subscription.skippedDates, subscription.nextDate]),
    ],
    nextDate: nextSubscriptionDate(subscription),
  });
}
export function paySubscription(input: {
  ledger: Ledger;
  id: string;
  rate: ExchangeRate;
}): Ledger {
  const subscription = input.ledger.subscriptions?.find(
    (item) => item.id === input.id,
  );
  if (
    !subscription ||
    subscription.isArchived ||
    ["paused", "canceled"].includes(subscription.status)
  )
    throw new Error("订阅不可扣费。");
  if (!subscription.accountId || input.rate.currency !== subscription.currency)
    throw new Error("请先填写有效的账户和汇率。");
  const temporary = applySubscriptions({
    ledger: {
      ...input.ledger,
      subscriptions: [{ ...subscription, status: "active", autoPost: true }],
    },
    today: subscription.nextDate,
    rates: [{ ...input.rate, requestedDate: subscription.nextDate }],
  });
  if (
    temporary.records.length === input.ledger.records.length &&
    !input.ledger.records.some(
      (record) =>
        record.id ===
        `subscription:${subscription.id}:${subscription.nextDate}`,
    )
  )
    throw new Error("本期扣费未生成，请检查账户及汇率。");
  const updated = temporary.subscriptions?.[0];
  return {
    ...temporary,
    subscriptions: input.ledger.subscriptions?.map((item) =>
      item.id === subscription.id && updated
        ? { ...updated, autoPost: subscription.autoPost }
        : item,
    ),
  };
}
export function dueExchangeRequests(
  ledger: Ledger,
  today: string,
): Array<{ currency: ExchangeRate["currency"]; date: string }> {
  const requests = new Map<
    string,
    { currency: ExchangeRate["currency"]; date: string }
  >();
  for (const original of ledger.subscriptions ?? []) {
    if (
      !original.autoPost ||
      original.currency === "CNY" ||
      original.isArchived ||
      ["paused", "canceled"].includes(original.status)
    )
      continue;
    let subscription = original;
    for (
      let count = 0;
      count < MAX_CATCHUP && subscription.nextDate <= today;
      count++
    ) {
      if (
        !subscription.skippedDates.includes(subscription.nextDate) &&
        !ledger.records.some(
          (record) =>
            record.id ===
            `subscription:${subscription.id}:${subscription.nextDate}`,
        )
      )
        requests.set(`${subscription.currency}:${subscription.nextDate}`, {
          currency: subscription.currency,
          date: subscription.nextDate,
        });
      subscription = {
        ...subscription,
        nextDate: nextSubscriptionDate(subscription),
      };
    }
  }
  return [...requests.values()];
}
