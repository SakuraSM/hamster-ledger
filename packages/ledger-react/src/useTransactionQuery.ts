import { useMemo } from "react";
import {
  createTransactionIndex,
  queryTransactions,
  summarize,
  type BillRecord,
  type Ledger,
  type TransactionFilter,
} from "@hamster-ledger/core";

export function useTransactionQuery(
  ledger: Ledger,
  filter: TransactionFilter,
  records: BillRecord[] = ledger.records,
): {
  records: BillRecord[];
  error: string;
  summary: ReturnType<typeof summarize>;
} {
  const index = useMemo(
    () => createTransactionIndex(records, ledger.accounts),
    [records, ledger.accounts],
  );
  const result = useMemo(
    () => queryTransactions(ledger, index, filter),
    [ledger, index, filter],
  );
  const summary = useMemo(() => summarize(result.records), [result.records]);
  return { ...result, summary };
}
