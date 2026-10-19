import { validateAccountMoney } from "./account-money-bounds.js";
import type { Ledger } from "./model.js";
const MAX_TOTAL = BigInt(Number.MAX_SAFE_INTEGER);

/** Any date/category filter must be safe, even when it omits offsetting entries. */
export function validateAggregateAmounts(ledger: Ledger): void {
  validateAccountMoney(ledger);
  let positive = 0n;
  let negative = 0n;
  for (const record of ledger.records) {
    if (record.isDeleted || record.status !== "confirmed") continue;
    if (record.kind === "收入" || record.kind === "退款")
      positive += BigInt(record.amount);
    if (record.kind === "支出") negative += BigInt(record.amount);
    if (positive > MAX_TOTAL || negative > MAX_TOTAL)
      throw new Error("账本累计金额超过安全范围，请核对异常金额后重试。");
  }
}
