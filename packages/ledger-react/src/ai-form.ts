import type { AiDraft, AdvancedEntryInput, Ledger } from "@hamster-ledger/core";
import type { EntryDraft } from "./advanced-entry-form.js";
export function aiEntryDraft(draft: AiDraft): Partial<EntryDraft> {
  const item = draft.candidate;
  return {
    id: `ai:${draft.id}`,
    type: item.type,
    amount: item.amount,
    date: item.date,
    merchant: item.merchant,
    description: item.description,
    category: item.category,
    accountId: item.accountId ?? "",
    rate: item.currency === "CNY" ? "1" : "",
    rateDate: item.date.slice(0, 10),
  };
}
export function aiEditedEntry(
  ledger: Ledger,
  draft: AiDraft,
): AdvancedEntryInput {
  const record = ledger.records.find((item) => item.id === `ai:${draft.id}`);
  if (!record?.detail) throw new Error("交易明细缺失。");
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
