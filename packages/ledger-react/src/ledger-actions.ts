import {
  RECORD_STATUS,
  normalizeLegacyRecord,
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
  const isAdvanced = record.detail && record.detail.origin !== "legacy";
  if (
    isAdvanced &&
    (input.kind !== record.kind ||
      (input.accountId !== undefined && input.accountId !== record.accountId) ||
      (input.transferToAccountId !== undefined &&
        input.transferToAccountId !== record.transferToAccountId))
  )
    throw new Error(
      "这笔交易含币种或关联信息，请使用完整交易编辑修改类型和账户。",
    );
  if (
    !isAdvanced &&
    [input.accountId, input.transferToAccountId].some(
      (id) =>
        id &&
        (ledger.accounts.find((account) => account.id === id)?.currency ??
          "CNY") !== "CNY",
    )
  )
    throw new Error("外币账户须使用完整交易编辑。");
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
          detail: item.detail,
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
    records: records.map((item) =>
      item.id === input.id ? normalizeLegacyRecord(item) : item,
    ),
    rules: input.remember
      ? { ...ledger.rules, [record.merchant]: input.category }
      : ledger.rules,
  };
}
