import { categoryNames } from "./categories.js";
import { resolveAssetAccount } from "./account-links.js";
import type { BillRecord, Ledger } from "./model.js";
/** Reuse confirmed simple transactions; never turn draft or transfer data into a template. */
export function quickEntryTemplates(ledger: Ledger): BillRecord[] {
  const groups = new Map<string, { record: BillRecord; count: number }>();
  for (const record of ledger.records) {
    if (
      record.isDeleted ||
      record.status !== "confirmed" ||
      !["支出", "收入"].includes(record.kind) ||
      (record.detail && record.detail.origin !== "legacy") ||
      !categoryNames(ledger, record.kind).includes(record.category)
    )
      continue;
    const account = resolveAssetAccount(record, ledger.accounts);
    if (account?.isArchived || (account?.currency ?? "CNY") !== "CNY") continue;
    const key = JSON.stringify([
      record.merchant,
      record.kind,
      record.category,
      account?.id ?? null,
    ]);
    const prior = groups.get(key);
    groups.set(key, {
      record: prior && prior.record.date > record.date ? prior.record : record,
      count: (prior?.count ?? 0) + 1,
    });
  }
  return [...groups.values()]
    .sort(
      (a, b) => b.count - a.count || b.record.date.localeCompare(a.record.date),
    )
    .slice(0, 5)
    .map((item) => item.record);
}
