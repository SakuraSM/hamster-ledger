import {
  resolveAssetAccount,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import type { EntryDraft } from "@hamster-ledger/ledger-react";

export function assetTransferDraft(
  account?: AssetAccount,
): Partial<EntryDraft> {
  const isRepayment = account?.kind === "liability";
  return {
    type: "transfer",
    accountId: isRepayment ? "" : (account?.id ?? ""),
    destinationId: isRepayment ? account.id : "",
    merchant: isRepayment
      ? account.type === "信用卡"
        ? "信用卡还款"
        : "负债还款"
      : "账户转账",
  };
}

export function unassignedAssetRecords(ledger: Ledger): BillRecord[] {
  return ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.status === "confirmed" &&
      (record.kind === "收入" ||
        record.kind === "支出" ||
        record.kind === "退款") &&
      !record.detail?.movements.length &&
      !resolveAssetAccount(record, ledger.accounts),
  );
}
