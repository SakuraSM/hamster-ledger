import type { AssetAccount } from "./account-model.js";
import {
  resolveAssetAccount,
  UNASSIGNED_ACCOUNT_FILTER,
} from "./account-links.js";
import type { BillRecord, Kind, Ledger, Source } from "./model.js";
import { isValidDate } from "./periods.js";
import {
  createFinanceFilter,
  type FinanceFilter,
} from "./record-management.js";

export interface TransactionFilter extends FinanceFilter {
  query?: string;
  source?: Source | "";
  category?: string;
  kind?: Kind | "";
  status?: BillRecord["status"] | "";
  isDeleted?: boolean;
  startDate?: string;
  endDate?: string;
}
interface IndexedTransaction {
  record: BillRecord;
  text: string;
  accountIds: Set<string>;
}

/** Cache search text, account resolution and ordering until the data changes. */
export function createTransactionIndex(
  records: BillRecord[],
  accounts: AssetAccount[],
): IndexedTransaction[] {
  return records
    .map((record) => {
      const accountIds = new Set<string>();
      const account = resolveAssetAccount(record, accounts);
      if (account) accountIds.add(account.id);
      if (record.transferToAccountId)
        accountIds.add(record.transferToAccountId);
      for (const movement of record.detail?.movements ?? [])
        accountIds.add(movement.accountId);
      return {
        record,
        accountIds,
        text: [
          record.merchant,
          record.description,
          record.account,
          record.category,
          record.orderId,
          ...(record.tags ?? []),
        ]
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort((left, right) => right.record.date.localeCompare(left.record.date));
}

export function queryTransactions(
  ledger: Ledger,
  index: IndexedTransaction[],
  filter: TransactionFilter,
): { records: BillRecord[]; error: string } {
  const { startDate = "", endDate = "" } = filter;
  if (
    (startDate && !isValidDate(startDate)) ||
    (endDate && !isValidDate(endDate))
  )
    return { records: [], error: "请输入有效的起止日期。" };
  if (startDate && endDate && startDate > endDate)
    return { records: [], error: "开始日期不能晚于结束日期。" };
  const query = filter.query?.trim().toLowerCase() ?? "";
  const matchesFinance = createFinanceFilter(ledger, {
    memberId: filter.memberId,
    reimbursement: filter.reimbursement,
  });
  const records = index
    .filter(({ record, text, accountIds }) => {
      if (!!record.isDeleted !== !!filter.isDeleted) return false;
      if (
        filter.status
          ? record.status !== filter.status
          : !filter.isDeleted && record.status === "duplicate"
      )
        return false;
      if (filter.kind && record.kind !== filter.kind) return false;
      if (
        filter.source &&
        record.source !== filter.source &&
        !record.linkedSources.includes(filter.source)
      )
        return false;
      if (filter.category && record.category !== filter.category) return false;
      if (
        filter.accountId &&
        (filter.accountId === UNASSIGNED_ACCOUNT_FILTER
          ? accountIds.size > 0
          : !accountIds.has(filter.accountId))
      )
        return false;
      const day = record.date.slice(0, 10);
      return (
        (!startDate || day >= startDate) &&
        (!endDate || day <= endDate) &&
        (!query || text.includes(query)) &&
        matchesFinance(record)
      );
    })
    .map(({ record }) => record);
  return { records, error: "" };
}
