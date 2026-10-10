import {
  CURRENCIES,
  CURRENCY_DIGITS,
  categoryNames,
  parseMinor,
  saveSubscription,
  subscriptionSchema,
  type Ledger,
  type Subscription,
} from "@hamster-ledger/core";
import { accountOptions, value, type FinanceForm } from "./model.js";
export const SUBSCRIPTION_CYCLES = {
  weekly: "周",
  monthly: "月",
  quarterly: "季",
  halfYearly: "半年",
  yearly: "年",
};
export function subscriptionForm(
  ledger: Ledger,
  id: string,
  today: string,
  existing?: Subscription,
): FinanceForm {
  const currency = existing?.currency ?? "CNY";
  return {
    title: existing ? "编辑订阅" : "新增订阅",
    initial: {
      name: existing?.name ?? "",
      amount: existing
        ? String(existing.amount / 10 ** CURRENCY_DIGITS[currency])
        : "",
      currency,
      accountId: existing?.accountId ?? "",
      category: existing?.category ?? "娱乐",
      cycle: existing?.cycle ?? "monthly",
      interval: String(existing?.interval ?? 1),
      anchorDay: String(existing?.anchorDay ?? Number(today.slice(8, 10))),
      nextDate: existing?.nextDate ?? today,
      status: existing?.status ?? "active",
      trialEnd: existing?.trialEnd ?? today,
      autoPost: existing?.autoPost ?? false,
      reminderDays: String(existing?.reminderDays ?? 3),
    },
    fields: [
      { key: "name", label: "订阅名称", type: "text" },
      { key: "amount", label: "每期原币金额", type: "money" },
      {
        key: "currency",
        label: "币种",
        type: "choice",
        options: CURRENCIES.map((item) => ({ value: item, label: item })),
      },
      {
        key: "accountId",
        label: "扣费账户",
        type: "choice",
        options: accountOptions(ledger),
      },
      {
        key: "category",
        label: "支出分类",
        type: "choice",
        options: categoryNames(ledger, "支出").map((name) => ({
          value: name,
          label: name,
        })),
      },
      {
        key: "cycle",
        label: "周期单位",
        type: "choice",
        options: Object.entries(SUBSCRIPTION_CYCLES).map(([value, label]) => ({
          value,
          label,
        })),
      },
      { key: "interval", label: "每 N 期（1–120）", type: "integer" },
      {
        key: "anchorDay",
        label: "每期常规扣费日（1–31）",
        type: "integer",
        visible: (values) => values.cycle !== "weekly",
      },
      { key: "nextDate", label: "下次扣费日期", type: "date" },
      {
        key: "status",
        label: "订阅状态",
        type: "choice",
        options: [
          { value: "active", label: "使用中" },
          { value: "trial", label: "试用中" },
          { value: "paused", label: "已暂停" },
          { value: "canceled", label: "已取消" },
        ],
      },
      {
        key: "trialEnd",
        label: "试用结束日期",
        type: "date",
        visible: (values) => values.status === "trial",
      },
      { key: "reminderDays", label: "提前提醒天数（0–30）", type: "integer" },
      {
        key: "autoPost",
        label: "到期自动记账",
        type: "toggle",
        hint: "默认只提醒。启用后按约定金额记账，联网账本由服务端执行。",
      },
    ],
    submit(current, values) {
      if (
        existing &&
        JSON.stringify(
          current.subscriptions?.find((item) => item.id === existing.id),
        ) !== JSON.stringify(existing)
      )
        throw new Error("订阅已更新，请保留表单内容并重新打开核对。");
      const moneyCurrency = subscriptionSchema.shape.currency.parse(
        values.currency,
      );
      return saveSubscription(
        current,
        subscriptionSchema.parse({
          ...existing,
          id: existing?.id ?? id,
          name: value(values, "name"),
          amount: parseMinor({
            value: value(values, "amount"),
            currency: moneyCurrency,
          }),
          currency: moneyCurrency,
          accountId: value(values, "accountId") || null,
          category: value(values, "category"),
          cycle: values.cycle,
          interval: Number(values.interval),
          anchorDay: Number(values.anchorDay),
          nextDate: values.nextDate,
          status: values.status,
          trialEnd: values.status === "trial" ? values.trialEnd : undefined,
          autoPost: values.autoPost,
          reminderDays: Number(values.reminderDays),
        }),
      );
    },
  };
}
