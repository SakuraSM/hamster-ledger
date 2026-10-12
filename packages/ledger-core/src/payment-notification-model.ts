import type { LedgerMode, Source } from "./model.js";
import type { TransactionDetail } from "./finance-model.js";
export type PaymentSource = Extract<Source, "支付宝" | "微信支付">;
export const PAYMENT_RECEIPT_STATE = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  LINKED: "linked",
  DISCARDED: "discarded",
} as const;
export interface PaymentReceipt {
  id: string;
  source: PaymentSource;
  bookId: Exclude<LedgerMode, "demo">;
  title: string;
  text: string;
  postedAt: number;
  capturedAt: number;
  isTruncated: boolean;
}
export interface PaymentCandidate {
  type: TransactionDetail["type"] | null;
  amount: string;
  currency: "CNY";
  merchant: string;
  date: string;
  orderId: string;
  issues: string[];
  isSupported: boolean;
}
export const PAYMENT_RECORD_PREFIX = "notification:";
export const PAYMENT_RECEIPT_IDS_FIELD = "paymentNotificationIds";
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60000;
export const PAYMENT_MATCH_WINDOW_MS =
  HOURS_PER_DAY * MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
const MINOR_SCALE = 100n;
const MINOR_DIGITS = 2;
export function paymentAmountString(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error("通知金额超出安全范围。");
  const amount = BigInt(minor);
  return `${amount / MINOR_SCALE}.${String(amount % MINOR_SCALE).padStart(MINOR_DIGITS, "0")}`;
}
