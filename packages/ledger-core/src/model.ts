import { addMinor } from "./currency.js";
import { dateTimeSchema } from "./date-schemas.js";
import {
  categoryDefinitionSchema,
  budgetSchema,
  recurringRuleSchema,
  preferencesSchema,
} from "./planning-model.js";
import { assetAccountSchema } from "./account-model.js";
import { z } from "zod";
import {
  transactionDetailSchema,
  subscriptionSchema,
  debtSchema,
  goalSchema,
  notificationSchema,
  auditEventSchema,
} from "./finance-model.js";

export const SOURCES = [
  "支付宝",
  "微信支付",
  "招商银行",
  "其他银行",
  "手动记账",
  "周期记账",
] as const;
export const CATEGORIES = [
  "购物",
  "餐饮",
  "居住",
  "交通",
  "日用",
  "工资",
  "娱乐",
  "医疗",
  "其他",
  "待分类",
] as const;
export const KINDS = ["支出", "收入", "转账", "退款", "不计收支"] as const;
export const RECORD_STATUS = {
  CONFIRMED: "confirmed",
  PENDING: "pending",
  DUPLICATE: "duplicate",
} as const;
export const REVIEW_STATUS = {
  PENDING: "pending",
  LINKED: "linked",
  SEPARATE: "separate",
} as const;
export const CENTS_PER_YUAN = 100;
export type Source = (typeof SOURCES)[number];
export type Category = string;
export type Kind = (typeof KINDS)[number];
export const recordSchema = z.object({
  id: z.string(),
  date: dateTimeSchema,
  merchant: z.string(),
  description: z.string(),
  amount: z.number().int().safe().nonnegative(),
  currency: z.literal("CNY"),
  kind: z.enum(KINDS),
  category: z.string().min(1),
  source: z.enum(SOURCES),
  account: z.string(),
  accountId: z.string().nullable().optional(),
  transferToAccountId: z.string().nullable().optional(),
  orderId: z.string(),
  status: z.enum(["confirmed", "pending", "duplicate"]),
  sourceStatus: z.string(),
  fileName: z.string(),
  raw: z.record(z.string(), z.string()),
  linkedSources: z.array(z.enum(SOURCES)),
  duplicateOf: z.string().optional(),
  reason: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isDeleted: z.boolean().optional(),
  recurringRuleId: z.string().optional(),
  detail: transactionDetailSchema.optional(),
});
export type BillRecord = z.infer<typeof recordSchema>;
export const reviewSchema = z.object({
  id: z.string(),
  leftId: z.string(),
  rightId: z.string(),
  state: z.enum(["pending", "linked", "separate"]),
  reasons: z.array(z.string()),
});
export type Review = z.infer<typeof reviewSchema>;
export const ledgerSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    baseCurrency: z.literal("CNY").optional(),
    records: z.array(recordSchema),
    reviews: z.array(reviewSchema),
    rules: z.record(z.string(), z.string()),
    files: z
      .array(z.object({ hash: z.string(), name: z.string() }))
      .default([]),
    accounts: z.array(assetAccountSchema).default([]),
    categories: z.array(categoryDefinitionSchema).optional(),
    budgets: z.array(budgetSchema).optional(),
    recurringRules: z.array(recurringRuleSchema).optional(),
    preferences: preferencesSchema.optional(),
    subscriptions: z.array(subscriptionSchema).optional(),
    debts: z.array(debtSchema).optional(),
    goals: z.array(goalSchema).optional(),
    notifications: z.array(notificationSchema).optional(),
    history: z.array(auditEventSchema).optional(),
  })
  .superRefine((ledger, context) => {
    for (const field of [
      "records",
      "reviews",
      "accounts",
      "categories",
      "budgets",
      "recurringRules",
      "subscriptions",
      "debts",
      "goals",
      "notifications",
    ] as const) {
      const values = ledger[field] ?? [];
      if (new Set(values.map((item) => item.id)).size !== values.length)
        context.addIssue({
          code: "custom",
          path: [field],
          message: "同一账本内的 ID 不能重复。",
        });
    }
  });
export type Ledger = z.infer<typeof ledgerSchema>;
export type LedgerMode = "demo" | "personal" | `book:${string}`;
export const EMPTY_LEDGER: Ledger = {
  version: 1,
  records: [],
  reviews: [],
  rules: {},
  files: [],
  accounts: [],
};

export function money(amount: number): string {
  return (amount / CENTS_PER_YUAN).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
export function signedMoney(record: BillRecord): string {
  const prefix =
    record.kind === "支出"
      ? "−"
      : record.kind === "收入" || record.kind === "退款"
        ? "+"
        : "";
  return `${prefix} ¥${money(record.amount)}`;
}
export function displayAccount(record: BillRecord): string {
  return record.account || "付款账户待确认";
}
export function summarize(records: BillRecord[]): {
  expense: number;
  income: number;
  net: number;
} {
  let expense = 0;
  let income = 0;
  for (const record of records) {
    if (record.isDeleted || record.status !== RECORD_STATUS.CONFIRMED) continue;
    if (record.kind === "支出") expense = addMinor(expense, record.amount);
    if (record.kind === "退款") expense = addMinor(expense, -record.amount);
    if (record.kind === "收入") income = addMinor(income, record.amount);
  }
  return { expense, income, net: addMinor(income, -expense) };
}
export function confirmedForMonth(ledger: Ledger, month: string): BillRecord[] {
  return ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.date.startsWith(month) &&
      record.status === RECORD_STATUS.CONFIRMED,
  );
}
