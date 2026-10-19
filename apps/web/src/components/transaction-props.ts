import type {
  Source,
  Category,
  AssetAccount,
  BillRecord,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
export interface BillFilter {
  source: Source | "";
  category: Category | "";
  accountId?: string;
}
export interface TransactionsProps {
  records: BillRecord[];
  controller: LedgerController;
  accounts: AssetAccount[];
  filter: BillFilter;
  onFilter: (filter: BillFilter) => void;
  onSelect: (record: BillRecord) => void;
  onClearPeriod: () => void;
}
