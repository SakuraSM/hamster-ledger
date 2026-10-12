import { dateTimeSchema } from "./date-schemas.js";
import { parseMinor } from "./currency.js";
import type {
  PaymentCandidate,
  PaymentReceipt,
} from "./payment-notification-model.js";
const FOREIGN_CURRENCY =
  /(?:^|[^A-Za-z])(?:USD|HKD|EUR|JPY|GBP|AUD|CAD|SGD)(?=$|[^A-Za-z])|美元|港币|欧元|日元|英镑|[$€£]/i;
const NON_TRANSACTION_AMOUNT =
  /(?:优惠|折扣|原价|余额|尾号|立减|红包|返现)(?:金额)?\s*[:：]?\s*(?:人民币)?\s*$/;
const MONEY_NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
const ACTUAL_AMOUNT = new RegExp(
  String.raw`(?:实付|实际支付|支付金额|付款金额|收款金额|交易金额|到账金额|消费金额)\s*[:：]?\s*(?:人民币|[¥￥])?\s*(${MONEY_NUMBER})(?![\d.,])`,
  "g",
);
const MONEY_AMOUNT = new RegExp(
  String.raw`(?:[¥￥]\s*(${MONEY_NUMBER})(?![\d.,])|(${MONEY_NUMBER})(?![\d.,])\s*元)`,
  "g",
);
const BARE_AMOUNT_GROUP = 2;
const AMOUNT_CONTEXT_WIDTH = 32;
const MAX_MERCHANT_LENGTH = 200;
const MINUTE_TIMESTAMP_LENGTH = 16;
function uniqueAmounts(values: string[]): string[] {
  const unique = new Map<number, string>();
  for (const value of values) {
    const normalized = value.replaceAll(",", "");
    try {
      unique.set(
        parseMinor({ value: normalized, currency: "CNY" }),
        normalized,
      );
    } catch {
      /* Invalid precision never becomes a partial amount. */
    }
  }
  return [...unique.values()];
}
function amounts(text: string): string[] {
  const explicit = [...text.matchAll(ACTUAL_AMOUNT)].map((match) => match[1]);
  if (explicit.length) return uniqueAmounts(explicit);
  return uniqueAmounts(
    [...text.matchAll(MONEY_AMOUNT)]
      .filter((match) => {
        const position = match.index ?? 0;
        if (match[BARE_AMOUNT_GROUP] && /[\d.,]/.test(text[position - 1] ?? ""))
          return false;
        return !NON_TRANSACTION_AMOUNT.test(
          text.slice(Math.max(0, position - AMOUNT_CONTEXT_WIDTH), position),
        );
      })
      .map((match) => match[1] ?? match[BARE_AMOUNT_GROUP]),
  );
}

function transactionType(text: string): PaymentCandidate["type"] {
  if (/退款(?:成功|到账)|已退回|退回金额/.test(text)) return "refund";
  if (
    /还款(?:成功|到账)|信用卡还款|提现(?:成功|到账)|充值(?:成功|到账)|借款(?:成功|到账)/.test(
      text,
    )
  )
    return null;
  if (/转账(?:成功|到账|通知)|转账金额/.test(text)) return "transfer";
  if (/收款(?:成功|到账)|收款金额|到账金额/.test(text)) return "income";
  if (/支付成功|付款成功|扣款成功|消费(?:成功|金额)|实付/.test(text))
    return "expense";
  return null;
}
export function parsePaymentNotification({
  receipt,
  localTimestamp,
}: {
  receipt: PaymentReceipt;
  localTimestamp: string;
}): PaymentCandidate {
  const text = receipt.title + "\n" + receipt.text;
  const issues: string[] = [];
  const isSupported = !FOREIGN_CURRENCY.test(text);
  if (!isSupported)
    issues.push("首版仅支持人民币，请通过完整记账处理外币交易。");
  const found = receipt.isTruncated ? [] : amounts(receipt.text);
  let amount = found.length === 1 ? found[0] : "";
  try {
    if (!amount || parseMinor({ value: amount, currency: "CNY" }) <= 0)
      amount = "";
  } catch {
    amount = "";
  }
  if (!amount) issues.push("实付金额不明确，请核对后填写。");
  if (receipt.isTruncated)
    issues.push("通知过长，已截断展示，请手动核对字段。");
  const type = transactionType(text);
  if (!type) issues.push("交易类型待选择。");
  const merchant =
    receipt.text
      .match(/(?:商户|交易对象|收款方|付款方)\s*[:：]\s*([^\n，,；;]+)/)?.[1]
      ?.trim() ??
    receipt.text.match(/向\s*(.+?)\s*(?:付款|支付)/)?.[1]?.trim() ??
    "";
  if (!merchant) issues.push("交易对象待填写。");
  const explicitTime = receipt.text
    .match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?/)?.[0]
    ?.replace("T", " ");
  const date = explicitTime
    ? explicitTime.length === MINUTE_TIMESTAMP_LENGTH
      ? explicitTime + ":00"
      : explicitTime
    : localTimestamp;
  if (!explicitTime) issues.push("暂用通知到达时间，请核对实际交易时间。");
  if (!dateTimeSchema.safeParse(date).success)
    issues.push("交易时间无效，请重新选择。");
  issues.push("请选择实际收付款账户，支付渠道不代表资金账户。");
  const orderId =
    receipt.text.match(
      /(?:^|[\n，,；;])\s*(?:退款单号|交易单号|流水号|订单号)\s*[:：]\s*([A-Za-z0-9_-]+)/,
    )?.[1] ?? "";
  return {
    type,
    amount,
    currency: "CNY",
    merchant: merchant.slice(0, MAX_MERCHANT_LENGTH),
    date,
    orderId,
    issues,
    isSupported,
  };
}
