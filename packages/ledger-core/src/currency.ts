import { z } from "zod";
import { dateSchema } from "./date-schemas.js";

export const CURRENCY_DIGITS = {
  CNY: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  JPY: 0,
  SGD: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  KRW: 0,
  TWD: 2,
  THB: 2,
  NZD: 2,
} as const;
export const CURRENCIES = Object.keys(CURRENCY_DIGITS) as Array<
  keyof typeof CURRENCY_DIGITS
>;
export type Currency = keyof typeof CURRENCY_DIGITS;
export const currencySchema = z.enum(CURRENCIES as [Currency, ...Currency[]]);
export const rateSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,12})?$/)
  .refine((value) => Number(value) > 0, "汇率必须大于零。");
export const exchangeRateSchema = z.object({
  currency: currencySchema,
  rate: rateSchema,
  date: dateSchema,
  source: z.enum(["manual", "frankfurter", "legacy"]),
});
export const originalMoneySchema = exchangeRateSchema.extend({
  minor: z.number().int().safe().nonnegative(),
});
export type ExchangeRate = z.infer<typeof exchangeRateSchema>;
export type OriginalMoney = z.infer<typeof originalMoneySchema>;

function safeNumber(value: bigint): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error("金额超过安全范围。");
  return amount;
}
export function parseMinor(input: {
  value: string;
  currency: Currency;
}): number {
  const digits = CURRENCY_DIGITS[input.currency];
  const match = input.value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match || (match[3]?.length ?? 0) > digits)
    throw new Error(`金额最多 ${digits} 位小数。`);
  const magnitude =
    BigInt(match[2]) * 10n ** BigInt(digits) +
    BigInt((match[3] ?? "").padEnd(digits, "0") || "0");
  return safeNumber(match[1] ? -magnitude : magnitude);
}
/** A rate is CNY per one major unit of the original currency. Round half away from zero. */
export function convertToCny(input: {
  minor: number;
  currency: Currency;
  rate: string;
}): number {
  if (!Number.isSafeInteger(input.minor))
    throw new Error("金额必须为安全整数。");
  rateSchema.parse(input.rate);
  const [whole, fraction = ""] = input.rate.split(".");
  const denominator =
    10n ** BigInt(fraction.length + CURRENCY_DIGITS[input.currency]);
  const numerator =
    BigInt(Math.abs(input.minor)) * BigInt(whole + fraction) * 100n;
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);
  return safeNumber(input.minor < 0 ? -rounded : rounded);
}
export function formatCurrency(input: {
  minor: number;
  currency: Currency;
}): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: input.currency,
    minimumFractionDigits: CURRENCY_DIGITS[input.currency],
    maximumFractionDigits: CURRENCY_DIGITS[input.currency],
  }).format(input.minor / 10 ** CURRENCY_DIGITS[input.currency]);
}
