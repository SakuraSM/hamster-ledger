import { z } from "zod";
import { dateSchema, dateTimeSchema } from "./date-schemas.js";
import { currencySchema, originalMoneySchema } from "./currency.js";

export const TRANSACTION_TYPES = [
  "expense",
  "income",
  "transfer",
  "aa_settlement",
  "refund",
  "lend",
  "borrow",
  "repay_receive",
  "repay_pay",
  "reimburse",
  "fee",
  "interest",
  "invest_buy",
  "invest_sell",
  "adjust",
  "excluded",
] as const;
export const TRANSACTION_LABELS: Record<
  (typeof TRANSACTION_TYPES)[number],
  string
> = {
  expense: "支出",
  income: "收入",
  transfer: "转账",
  aa_settlement: "AA 结算",
  refund: "退款",
  lend: "借出",
  borrow: "借入",
  repay_receive: "收回借款",
  repay_pay: "偿还借款",
  reimburse: "报销回款",
  fee: "手续费",
  interest: "利息收入",
  invest_buy: "投资买入",
  invest_sell: "投资卖出",
  adjust: "余额调整",
  excluded: "不计收支",
};
export const splitSchema = z.object({
  memberId: z.string().min(1),
  amount: z.number().int().safe().nonnegative(),
});
export const transactionDetailSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  original: originalMoneySchema,
  destination: originalMoneySchema.optional(),
  memberId: z.string().min(1).optional(),
  relatedId: z.string().optional(),
  debtId: z.string().optional(),
  subscriptionId: z.string().optional(),
  isReimbursable: z.boolean().optional(),
  attachmentIds: z.array(z.string()).max(10).default([]),
  splits: z.array(splitSchema).default([]),
  movements: z
    .array(z.object({ accountId: z.string(), amount: z.number().int().safe() }))
    .default([]),
  origin: z
    .enum(["manual", "ai", "api", "subscription", "legacy"])
    .default("manual"),
});
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;
export const subscriptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  amount: z.number().int().safe().positive(),
  currency: currencySchema.default("CNY"),
  accountId: z.string().nullable(),
  category: z.string(),
  cycle: z.enum(["weekly", "monthly", "quarterly", "halfYearly", "yearly"]),
  interval: z.number().int().min(1).max(120).default(1),
  anchorDay: z.number().int().min(1).max(31),
  nextDate: dateSchema,
  trialEnd: dateSchema.optional(),
  status: z.enum(["trial", "active", "paused", "canceled"]),
  autoPost: z.boolean().default(false),
  reminderDays: z.number().int().min(0).max(30).default(3),
  skippedDates: z.array(dateSchema).default([]),
  isArchived: z.boolean().default(false),
});
export type Subscription = z.infer<typeof subscriptionSchema>;
export const debtSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  direction: z.enum(["receivable", "payable"]),
  currency: currencySchema.default("CNY"),
  principal: z.number().int().safe().positive(),
  accountId: z.string(),
  counterAccountId: z.string(),
  openedOn: dateSchema,
  dueDate: dateSchema.optional(),
  isArchived: z.boolean().default(false),
});
export type Debt = z.infer<typeof debtSchema>;
export const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  target: z.number().int().safe().positive(),
  dueDate: dateSchema.optional(),
  accountId: z.string().nullable(),
  isArchived: z.boolean().default(false),
  allocations: z
    .array(
      z.object({
        id: z.string(),
        amount: z.number().int().safe(),
        date: dateSchema,
        recordId: z.string().optional(),
      }),
    )
    .default([]),
});
export type SavingsGoal = z.infer<typeof goalSchema>;
export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  date: dateSchema,
  entityId: z.string(),
  isRead: z.boolean().default(false),
});
export const auditEventSchema = z.object({
  id: z.string(),
  at: dateTimeSchema,
  actor: z.string(),
  action: z.string(),
  summary: z.string(),
});
export type LedgerNotification = z.infer<typeof notificationSchema>;
