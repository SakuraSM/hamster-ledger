import { categoryDefinitions } from "./categories.js";
import { addMinor } from "./currency.js";
import { validateFinancialIntegrity } from "./financial-integrity.js";
import type { BillRecord, Ledger } from "./model.js";
export type ReimbursementState =
  "" | "pending" | "partial" | "settled" | "none";
export function reimbursementState(
  ledger: Ledger,
  record: BillRecord,
): Exclude<ReimbursementState, ""> {
  if (!record.detail?.isReimbursable || record.kind !== "支出") return "none";
  const received = ledger.records
    .filter(
      (item) =>
        !item.isDeleted &&
        item.status === "confirmed" &&
        item.detail?.relatedId === record.id &&
        ["reimburse", "refund"].includes(item.detail.type),
    )
    .reduce((total, item) => addMinor(total, item.amount), 0);
  return received >= record.amount
    ? "settled"
    : received
      ? "partial"
      : "pending";
}
export function matchesFinanceFilters(
  ledger: Ledger,
  record: BillRecord,
  filter: {
    accountId?: string;
    memberId?: string;
    reimbursement?: ReimbursementState;
  },
): boolean {
  if (
    filter.accountId &&
    record.accountId !== filter.accountId &&
    record.transferToAccountId !== filter.accountId &&
    !record.detail?.movements.some(
      (item) => item.accountId === filter.accountId,
    )
  )
    return false;
  if (
    filter.memberId &&
    record.detail?.memberId !== filter.memberId &&
    !record.detail?.splits.some((item) => item.memberId === filter.memberId)
  )
    return false;
  return (
    !filter.reimbursement ||
    reimbursementState(ledger, record) === filter.reimbursement
  );
}
export function batchRecords(
  ledger: Ledger,
  input: {
    records: BillRecord[];
    action: "category" | "delete";
    category?: string;
  },
): Ledger {
  if (!input.records.length) throw new Error("请先选择账单。");
  const ids = new Set(input.records.map((item) => item.id));
  for (const expected of input.records) {
    const actual = ledger.records.find((item) => item.id === expected.id);
    if (
      !actual ||
      actual.isDeleted ||
      JSON.stringify(actual) !== JSON.stringify(expected)
    )
      throw new Error("所选账单已发生变化，请重新选择后操作。");
    if (
      input.action === "category" &&
      !categoryDefinitions(ledger).some(
        (item) =>
          !item.isArchived &&
          item.name === input.category &&
          item.kind === (actual.kind === "退款" ? "支出" : actual.kind),
      )
    )
      throw new Error("请选择与所有已选账单收支方向一致的有效分类。");
  }
  const next: Ledger = {
    ...ledger,
    records: ledger.records.map((item) =>
      !ids.has(item.id)
        ? item
        : input.action === "delete"
          ? { ...item, isDeleted: true }
          : { ...item, category: input.category! },
    ),
  };
  validateFinancialIntegrity(next);
  return next;
}
