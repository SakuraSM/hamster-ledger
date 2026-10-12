import { z } from "zod";
import type {
  LedgerMode,
  PaymentReceipt,
  PaymentSource,
} from "@hamster-ledger/core";
import nativeModule from "../../modules/payment-inbox";
export const PAYMENT_SOURCES: readonly PaymentSource[] = ["支付宝", "微信支付"];
const MAX_TITLE_LENGTH = 300;
const MAX_BODY_LENGTH = 4000;
const MAX_BOOK_ID_LENGTH = 128;
const RECEIPT_ID_LENGTH = 64;
const sourceSchema = z.enum(["支付宝", "微信支付"]);
const bookIdSchema = z
  .union([
    z.literal("personal"),
    z.templateLiteral(["book:", z.string().min(1)]),
  ])
  .refine((value) => value.length <= MAX_BOOK_ID_LENGTH);
export function isPaymentBookId(
  value: string,
): value is Exclude<LedgerMode, "demo"> {
  return bookIdSchema.safeParse(value).success;
}
const receiptSchema = z.object({
  id: z
    .string()
    .length(RECEIPT_ID_LENGTH)
    .regex(/^[a-f0-9]+$/),
  source: sourceSchema,
  bookId: bookIdSchema,
  title: z.string().max(MAX_TITLE_LENGTH),
  text: z.string().max(MAX_BODY_LENGTH),
  postedAt: z.number().int().safe().positive(),
  capturedAt: z.number().int().safe().positive(),
  isTruncated: z.boolean(),
});
export interface PaymentInboxConfig {
  enabled: boolean;
  sources: PaymentSource[];
  bookId: Exclude<LedgerMode, "demo"> | "";
}
export interface PaymentInboxStatus extends PaymentInboxConfig {
  available: boolean;
  permissionGranted: boolean;
  connected: boolean;
  pendingCount: number;
  error: string;
}
export type HandledPaymentState = "confirmed" | "linked" | "discarded";
function native(): NonNullable<typeof nativeModule> {
  if (!nativeModule)
    throw new Error("此安装包不含支付通知模块，请安装新的原生 APK。");
  return nativeModule;
}
export const paymentInbox = {
  async status(): Promise<PaymentInboxStatus> {
    const value = z
      .object({
        available: z.boolean(),
        enabled: z.boolean(),
        sources: z.array(sourceSchema),
        bookId: z.union([bookIdSchema, z.literal("")]),
        permissionGranted: z.boolean(),
        connected: z.boolean(),
        pendingCount: z.number().int().nonnegative(),
        error: z.string(),
      })
      .parse(await native().getStatus());
    return value;
  },
  async pending(): Promise<PaymentReceipt[]> {
    return receiptSchema.array().parse(await native().listPending());
  },
  async configure(config: PaymentInboxConfig): Promise<void> {
    if (config.enabled && (!config.bookId || !config.sources.length))
      throw new Error("请选择本机账本和支付来源。");
    await native().configure(JSON.stringify(config));
  },
  async handled(input: {
    id: string;
    state: HandledPaymentState;
    recordId?: string;
  }): Promise<void> {
    await native().handle(
      JSON.stringify({ ...input, recordId: input.recordId ?? null }),
    );
  },
  async clear(): Promise<void> {
    await native().clear();
  },
  async openSettings(): Promise<void> {
    await native().openSettings();
  },
  subscribe(listener: () => void): () => void {
    const subscription = native().addListener("onInboxChanged", listener);
    return () => subscription.remove();
  },
};
export type PaymentInboxAdapter = typeof paymentInbox;
