import {
  RECORD_STATUS,
  assertRecordUnchanged,
  type BillRecord,
  type Category,
  type Kind,
  type Ledger,
} from "@hamster-ledger/core";
export interface RecordEdit {
  expectedRecord?: BillRecord;
  id: string;
  category: Category;
  kind: Kind;
  account: string;
  remember: boolean;
  accountId?: string | null;
  transferToAccountId?: string | null;
}
export function editLedgerRecord(ledger: Ledger, input: RecordEdit): Ledger {
  const record = ledger.records.find((item) => item.id === input.id);
  assertRecordUnchanged({ current: record, expected: input.expectedRecord });
  if (!record) throw new Error("账单不存在，请重新打开详情。");
  if (
    input.accountId &&
    !ledger.accounts.some((account) => account.id === input.accountId)
  )
    throw new Error("关联账户不存在，请重新选择。");
  if (
    input.transferToAccountId &&
    !ledger.accounts.some((account) => account.id === input.transferToAccountId)
  )
    throw new Error("转入账户不存在，请重新选择。");
  if (
    input.kind === "转账" &&
    input.accountId &&
    input.accountId === input.transferToAccountId
  )
    throw new Error("转出与转入账户不能相同。");
  const hasPendingReview = ledger.reviews.some(
    (review) =>
      review.state === "pending" &&
      (review.leftId === input.id || review.rightId === input.id),
  );
  const records = ledger.records.map((item) =>
    item.id === input.id
      ? {
          ...item,
          category: input.category,
          kind: input.kind,
          account: input.account,
          ...(input.accountId !== undefined
            ? { accountId: input.accountId }
            : {}),
          ...(input.transferToAccountId !== undefined
            ? { transferToAccountId: input.transferToAccountId }
            : {}),
          status:
            hasPendingReview || item.status === RECORD_STATUS.DUPLICATE
              ? item.status
              : RECORD_STATUS.CONFIRMED,
        }
      : item,
  );
  return {
    ...ledger,
    records,
    rules: input.remember
      ? { ...ledger.rules, [record.merchant]: input.category }
      : ledger.rules,
  };
}
