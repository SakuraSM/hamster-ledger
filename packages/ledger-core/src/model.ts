import { z } from "zod";

export const SOURCES = ["支付宝", "微信支付", "招商银行", "其他银行"] as const;
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
export type Category = (typeof CATEGORIES)[number];
export type Kind = (typeof KINDS)[number];
export const recordSchema = z.object({
  id: z.string(),
  date: z.string(),
  merchant: z.string(),
  description: z.string(),
  amount: z.number().int().nonnegative(),
  currency: z.literal("CNY"),
  kind: z.enum(KINDS),
  category: z.enum(CATEGORIES),
  source: z.enum(SOURCES),
  account: z.string(),
  orderId: z.string(),
  status: z.enum(["confirmed", "pending", "duplicate"]),
  sourceStatus: z.string(),
  fileName: z.string(),
  raw: z.record(z.string(), z.string()),
  linkedSources: z.array(z.enum(SOURCES)),
  duplicateOf: z.string().optional(),
  reason: z.string().optional(),
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
export const ledgerSchema = z.object({
  version: z.literal(1),
  records: z.array(recordSchema),
  reviews: z.array(reviewSchema),
  rules: z.record(z.string(), z.enum(CATEGORIES)),
  files: z.array(z.object({ hash: z.string(), name: z.string() })).default([]),
});
export type Ledger = z.infer<typeof ledgerSchema>;
export type LedgerMode = "demo" | "personal";
export const EMPTY_LEDGER: Ledger = {
  version: 1,
  records: [],
  reviews: [],
  rules: {},
  files: [],
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
    if (record.status !== RECORD_STATUS.CONFIRMED) continue;
    if (record.kind === "支出") expense += record.amount;
    if (record.kind === "退款") expense -= record.amount;
    if (record.kind === "收入") income += record.amount;
  }
  return { expense, income, net: income - expense };
}
export function confirmedForMonth(ledger: Ledger, month: string): BillRecord[] {
  return ledger.records.filter(
    (record) =>
      record.date.startsWith(month) &&
      record.status === RECORD_STATUS.CONFIRMED,
  );
}
