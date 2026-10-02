import type { BillRecord } from "./model.js";
export class RecordConflictError extends Error {
  constructor() {
    super("这笔账单已发生变化，请加载最新账单后再编辑；当前修改尚未保存。");
    this.name = "RecordConflictError";
  }
}
function editableSnapshot(record: BillRecord): string {
  return JSON.stringify({
    id: record.id,
    date: record.date,
    merchant: record.merchant,
    description: record.description,
    amount: record.amount,
    currency: record.currency,
    kind: record.kind,
    category: record.category,
    tags: record.tags ?? [],
    account: record.account,
    accountId: record.accountId,
    transferToAccountId: record.transferToAccountId,
    status: record.status,
    isDeleted: record.isDeleted ?? false,
    duplicateOf: record.duplicateOf,
    linkedSources: record.linkedSources,
  });
}
export function assertRecordUnchanged(input: {
  current: BillRecord | undefined;
  expected?: BillRecord;
}): void {
  if (
    input.expected &&
    (!input.current ||
      editableSnapshot(input.current) !== editableSnapshot(input.expected))
  )
    throw new RecordConflictError();
}
