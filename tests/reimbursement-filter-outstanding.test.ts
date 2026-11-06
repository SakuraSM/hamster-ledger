import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  migrateLedger,
  saveAdvancedEntry,
  savedFiltersSchema,
  type AdvancedEntryInput,
  type Ledger,
} from "@hamster-ledger/core";
import {
  createFinanceFilter,
  matchesFinanceFilters,
  reimbursementState,
} from "../packages/ledger-core/src/record-management";
import {
  createTransactionIndex,
  queryTransactions,
} from "../packages/ledger-core/src/transaction-query";

function entry(input: {
  id: string;
  amount: number;
  type: "expense" | "reimburse";
  relatedId?: string;
  isReimbursable?: boolean;
}): AdvancedEntryInput {
  return {
    id: input.id,
    date: "2026-10-03 12:00:00",
    merchant: input.id,
    category: "购物",
    accountId: "cash",
    detail: {
      type: input.type,
      original: {
        currency: "CNY",
        minor: input.amount,
        rate: "1",
        date: "2026-10-03",
        source: "manual",
      },
      relatedId: input.relatedId,
      isReimbursable: input.isReimbursable,
      splits: [],
      movements: [],
      attachmentIds: [],
      origin: "manual",
    },
  };
}
function ledgerWithReturns(): Ledger {
  let ledger = migrateLedger({
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name: "现金",
        kind: "asset",
        type: "现金",
        openingBalance: 100000,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        checkpoints: [],
        isArchived: false,
      },
    ],
  });
  for (const id of ["pending", "partial", "settled", "ordinary"]) {
    ledger = saveAdvancedEntry(
      ledger,
      entry({
        id,
        type: "expense",
        amount: 20000,
        isReimbursable: id !== "ordinary",
      }),
    );
  }
  for (const [id, relatedId, amount] of [
    ["partial-return", "partial", 8000],
    ["settled-return", "settled", 20000],
  ] as const) {
    ledger = saveAdvancedEntry(
      ledger,
      entry({ id, type: "reimburse", amount, relatedId }),
    );
  }
  return ledger;
}

describe("outstanding reimbursement filter", () => {
  it("includes fully unpaid and partially repaid expenses while preserving exact states", () => {
    const ledger = ledgerWithReturns();
    const index = createTransactionIndex(ledger.records, ledger.accounts);
    expect(reimbursementState(ledger, ledger.records[1])).toBe("partial");
    for (const [filter, expected] of [
      ["pending", ["partial", "pending"]],
      ["partial", ["partial"]],
      ["settled", ["settled"]],
    ] as const) {
      const query = { reimbursement: filter };
      const perRecord = ledger.records
        .filter((record) => matchesFinanceFilters(ledger, record, query))
        .map((record) => record.id)
        .sort();
      const indexed = ledger.records
        .filter(createFinanceFilter(ledger, query))
        .map((record) => record.id)
        .sort();
      const list = queryTransactions(ledger, index, query)
        .records.map((record) => record.id)
        .sort();
      expect({ perRecord, indexed, list }).toEqual({
        perRecord: expected,
        indexed: expected,
        list: expected,
      });
    }
  });

  it("reads saved version 1 filters without introducing a new stored value", () => {
    const saved = savedFiltersSchema.parse({
      version: 1,
      last: { filter: { reimbursement: "pending" }, position: 0 },
      presets: [{ name: "待报销", filter: { reimbursement: "pending" } }],
    });
    expect(saved.last?.filter.reimbursement).toBe("pending");
    expect(savedFiltersSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(
      saved,
    );
  });
});
