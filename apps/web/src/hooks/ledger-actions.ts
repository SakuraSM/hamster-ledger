import {
  RECORD_STATUS,
  type Category,
  type Kind,
  type Ledger,
} from "@hamster-ledger/core";
export interface RecordEdit {
  id: string;
  category: Category;
  kind: Kind;
  account: string;
  remember: boolean;
}
export function editLedgerRecord(ledger: Ledger, input: RecordEdit): Ledger {
  const record = ledger.records.find((item) => item.id === input.id);
  if (!record) throw new Error("账单不存在，请重新打开详情。");
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
