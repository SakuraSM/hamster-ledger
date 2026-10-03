import { assertRecordUnchanged } from "./record-conflicts.js";
import { recordGroupIds } from "./record-groups.js";
import {
  recordSchema,
  RECORD_STATUS,
  type BillRecord,
  type Ledger,
  type Kind,
} from "./model.js";
import { isValidDateTime } from "./date-schemas.js";
export interface EntryInput {
  expectedRecord?: BillRecord;
  id: string;
  date: string;
  merchant: string;
  amount: number;
  kind: Kind;
  category: string;
  description: string;
  tags: string[];
  accountId: string | null;
  transferToAccountId: string | null;
}
export function saveEntry(ledger: Ledger, input: EntryInput): Ledger {
  if (!isValidDateTime(input.date)) throw new Error("请填写有效日期时间。");
  if (!input.merchant.trim()) throw new Error("请填写商户或交易说明。");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
    throw new Error("金额必须大于零且最多两位小数。");
  for (const id of [input.accountId, input.transferToAccountId])
    if (id && !ledger.accounts.some((account) => account.id === id))
      throw new Error("关联账户不存在。");
  if (
    input.kind === "转账" &&
    (!input.accountId ||
      !input.transferToAccountId ||
      input.accountId === input.transferToAccountId)
  )
    throw new Error("转账需要两个不同的账户。");
  if (
    [input.accountId, input.transferToAccountId].some(
      (id) =>
        id &&
        (ledger.accounts.find((account) => account.id === id)?.currency ??
          "CNY") !== "CNY",
    )
  )
    throw new Error("外币账户请使用完整交易记账。");
  const previous = ledger.records.find((record) => record.id === input.id);
  if (previous?.detail && previous.detail.origin !== "legacy")
    throw new Error("请使用完整交易编辑，保留币种及关联信息。");
  assertRecordUnchanged({ current: previous, expected: input.expectedRecord });
  if (
    previous &&
    (previous.status !== "confirmed" ||
      previous.isDeleted ||
      ledger.records.some((item) => item.duplicateOf === previous.id))
  )
    throw new Error(
      "有关联流水或待核对的账单，请先使用详情中的分类与账户编辑。",
    );
  const record: BillRecord = recordSchema.parse({
    ...previous,
    detail: undefined,
    id: input.id,
    date: input.date,
    merchant: input.merchant.trim(),
    amount: input.amount,
    kind: input.kind,
    category: input.category,
    description: input.description,
    tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
    accountId: input.accountId,
    transferToAccountId:
      input.kind === "转账" ? input.transferToAccountId : null,
    currency: "CNY",
    account:
      previous?.account ??
      ledger.accounts.find((account) => account.id === input.accountId)?.name ??
      "",
    source: previous?.source ?? "手动记账",
    sourceStatus: previous?.sourceStatus ?? "手动确认",
    orderId: previous?.orderId ?? "",
    fileName: previous?.fileName ?? "手动记账",
    raw: previous?.raw ?? {},
    linkedSources: previous?.linkedSources ?? [],
    status: previous?.status ?? RECORD_STATUS.CONFIRMED,
  });
  return {
    ...ledger,
    records: previous
      ? ledger.records.map((item) => (item.id === record.id ? record : item))
      : [...ledger.records, record],
  };
}
export function deleteEntry(ledger: Ledger, id: string): Ledger {
  const ids = recordGroupIds(ledger.records, id);
  if (
    ledger.reviews.some(
      (review) =>
        review.state === "pending" &&
        (ids.has(review.leftId) || ids.has(review.rightId)),
    )
  )
    throw new Error("请先完成重复核对，再删除账单。");
  return {
    ...ledger,
    records: ledger.records.map((record) =>
      ids.has(record.id) ? { ...record, isDeleted: true } : record,
    ),
  };
}
export function restoreEntry(ledger: Ledger, id: string): Ledger {
  const ids = recordGroupIds(ledger.records, id);
  return {
    ...ledger,
    records: ledger.records.map((record) =>
      ids.has(record.id) ? { ...record, isDeleted: false } : record,
    ),
  };
}
