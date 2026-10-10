import {
  ledgerSchema,
  type Ledger,
  type Kind,
  type BillRecord,
} from "./model.js";
import type { TransactionDetail } from "./finance-model.js";

const LEGACY_TYPES: Record<Kind, TransactionDetail["type"]> = {
  支出: "expense",
  收入: "income",
  转账: "transfer",
  退款: "refund",
  不计收支: "excluded",
};
export function migrateLedger(value: unknown): Ledger {
  const previous = ledgerSchema.parse(value);
  return ledgerSchema.parse({
    ...previous,
    version: 2,
    baseCurrency: "CNY",
    records: previous.records.map(normalizeLegacyRecord),
    accounts: previous.accounts.map((account) => ({
      ...account,
      currency: account.currency ?? "CNY",
    })),
  });
}

export function normalizeLegacyRecord(record: BillRecord): BillRecord {
  if (record.detail && record.detail.origin !== "legacy") return record;
  return {
    ...record,
    detail: {
      type: LEGACY_TYPES[record.kind],
      original: {
        minor: record.amount,
        currency: "CNY",
        rate: "1",
        date: record.date.slice(0, 10),
        source: "legacy",
      },
      attachmentIds: record.detail?.attachmentIds ?? [],
      memberId: record.detail?.memberId,
      splits: [],
      movements: [],
      origin: "legacy",
    },
  };
}
