import {
  saveAdvancedEntry,
  type AdvancedEntryInput,
} from "./advanced-entries.js";
import { validateFinancialIntegrity } from "./financial-integrity.js";
import { parseMinor } from "./currency.js";
import type { BillRecord, Ledger } from "./model.js";
import {
  PAYMENT_MATCH_WINDOW_MS,
  PAYMENT_RECORD_PREFIX,
  PAYMENT_RECEIPT_IDS_FIELD,
  type PaymentCandidate,
  type PaymentReceipt,
} from "./payment-notification-model.js";
function receiptIds(record: BillRecord): string[] {
  try {
    const parsed: unknown = JSON.parse(
      record.raw[PAYMENT_RECEIPT_IDS_FIELD] ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}
export function paymentReceiptRecord({
  ledger,
  receiptId,
}: {
  ledger: Ledger;
  receiptId: string;
}): BillRecord | undefined {
  return ledger.records.find((record) =>
    receiptIds(record).includes(receiptId),
  );
}
function taggedRecord({
  record,
  receipt,
  isNew,
  orderId,
}: {
  record: BillRecord;
  receipt: PaymentReceipt;
  isNew: boolean;
  orderId: string;
}): BillRecord {
  return {
    ...record,
    ...(isNew
      ? {
          source: receipt.source,
          fileName: "支付通知",
          sourceStatus: "通知确认",
          orderId,
        }
      : {}),
    linkedSources: [...new Set([...record.linkedSources, receipt.source])],
    raw: {
      ...record.raw,
      [PAYMENT_RECEIPT_IDS_FIELD]: JSON.stringify([
        ...new Set([...receiptIds(record), receipt.id]),
      ]),
    },
  };
}
export function confirmPaymentNotification({
  ledger,
  receipt,
  entry,
  orderId = "",
}: {
  ledger: Ledger;
  receipt: PaymentReceipt;
  entry: AdvancedEntryInput;
  orderId?: string;
}): Ledger {
  if (paymentReceiptRecord({ ledger, receiptId: receipt.id })) return ledger;
  if (entry.detail.original.currency !== "CNY")
    throw new Error("支付通知首版仅支持人民币账户。");
  const ordinaryKind =
    entry.detail.type === "expense"
      ? "支出"
      : entry.detail.type === "income"
        ? "收入"
        : null;
  if (
    orderId &&
    ordinaryKind &&
    ledger.records.some(
      (record) =>
        record.source === receipt.source &&
        record.orderId === orderId &&
        record.kind === ordinaryKind,
    )
  )
    throw new Error(
      "交易号已存在，请先核对已有账单或重复核对（含回收站），不能重复入账。",
    );
  const id = PAYMENT_RECORD_PREFIX + receipt.id;
  if (ledger.records.some((record) => record.id === id))
    throw new Error("采集标识已占用，请核对已有账单。");
  const next = saveAdvancedEntry(ledger, {
    ...entry,
    id,
    expectedRecord: undefined,
    detail: { ...entry.detail, origin: "manual" },
  });
  next.records = next.records.map((record) =>
    record.id === id
      ? taggedRecord({ record, receipt, isNew: true, orderId })
      : record,
  );
  validateFinancialIntegrity(next);
  return next;
}
export function linkPaymentNotification({
  ledger,
  receipt,
  recordId,
}: {
  ledger: Ledger;
  receipt: PaymentReceipt;
  recordId: string;
}): Ledger {
  if (paymentReceiptRecord({ ledger, receiptId: receipt.id })) return ledger;
  const record = ledger.records.find(
    (item) =>
      item.id === recordId && !item.isDeleted && item.status === "confirmed",
  );
  if (!record) throw new Error("待关联账单已变化，请重新核对。");
  return {
    ...ledger,
    records: ledger.records.map((item) =>
      item.id === recordId
        ? taggedRecord({ record: item, receipt, isNew: false, orderId: "" })
        : item,
    ),
  };
}
export function paymentNotificationMatches({
  ledger,
  candidate,
  receipt,
}: {
  ledger: Ledger;
  candidate: PaymentCandidate;
  receipt: PaymentReceipt;
}): BillRecord[] {
  if (!candidate.isSupported || !candidate.amount) return [];
  let amount: number;
  try {
    amount = parseMinor({ value: candidate.amount, currency: "CNY" });
  } catch {
    return [];
  }
  return ledger.records.filter((record) => {
    if (record.isDeleted || record.status !== "confirmed") return false;
    if (
      candidate.orderId &&
      record.source === receipt.source &&
      record.orderId === candidate.orderId
    )
      return true;
    const original = record.detail?.original;
    if (original && original.currency !== "CNY") return false;
    if ((original?.minor ?? record.amount) !== amount) return false;
    const kind =
      candidate.type === "expense"
        ? "支出"
        : candidate.type === "income"
          ? "收入"
          : candidate.type === "refund"
            ? "退款"
            : candidate.type === "transfer"
              ? "转账"
              : null;
    if (kind && kind !== record.kind) return false;
    const difference = Math.abs(
      Date.parse(record.date.replace(" ", "T")) -
        Date.parse(candidate.date.replace(" ", "T")),
    );
    return Number.isFinite(difference) && difference <= PAYMENT_MATCH_WINDOW_MS;
  });
}

export function paymentEditedEntry({
  ledger,
  receiptId,
}: {
  ledger: Ledger;
  receiptId: string;
}): AdvancedEntryInput {
  const record = ledger.records.find(
    (item) => item.id === PAYMENT_RECORD_PREFIX + receiptId,
  );
  if (!record?.detail) throw new Error("交易明细缺失，草稿已保留。");
  return {
    id: record.id,
    date: record.date,
    merchant: record.merchant,
    description: record.description,
    category: record.category,
    accountId: record.accountId ?? "",
    transferToAccountId: record.transferToAccountId,
    tags: record.tags,
    detail: record.detail,
    adjustmentSign:
      record.detail.type === "adjust" &&
      (record.detail.movements[0]?.amount ?? 0) *
        (ledger.accounts.find((account) => account.id === record.accountId)
          ?.kind === "liability"
          ? -1
          : 1) <
        0
        ? -1
        : 1,
  };
}
