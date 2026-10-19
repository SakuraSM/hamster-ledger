const DATE_KEY_LENGTH = 10;
const TREND_PREVIOUS_MONTHS = 5;
import { accountBaselines } from "./account-baselines.js";
import { projectAccountBalance, summarizeAssets } from "./asset-balances.js";
import { addMinor, type ExchangeRate } from "./currency.js";
import { dateSchema } from "./date-schemas.js";
import type { Ledger } from "./model.js";

export function assetComparisonDate(date: string): string {
  dateSchema.parse(date);
  const cursor = new Date(date + "T00:00:00Z");
  cursor.setUTCDate(0);
  return cursor.toISOString().slice(0, DATE_KEY_LENGTH);
}

export function assetTrendStart(input: {
  ledger: Ledger;
  end: string;
}): string {
  dateSchema.parse(input.end);
  const cursor = new Date(input.end + "T00:00:00Z");
  cursor.setUTCMonth(cursor.getUTCMonth() - TREND_PREVIOUS_MONTHS, 1);
  const start = cursor.toISOString().slice(0, DATE_KEY_LENGTH);
  const firstDates = input.ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) =>
      accountBaselines(account)[0].at.slice(0, DATE_KEY_LENGTH),
    );
  return [start, ...firstDates].sort().at(-1) ?? start;
}

export function compareAssets(input: {
  ledger: Ledger;
  date: string;
  currentRates: ExchangeRate[];
  previousRates: ExchangeRate[];
}): {
  previousDate: string;
  netChange: number | null;
  accountChanges: Record<string, number | null>;
  unavailableAccounts: string[];
} {
  const previousDate = assetComparisonDate(input.date);
  const current = summarizeAssets({
    ledger: input.ledger,
    through: input.date + " 23:59:59",
    rates: input.currentRates,
  });
  const previous = summarizeAssets({
    ledger: input.ledger,
    through: previousDate + " 23:59:59",
    rates: input.previousRates,
  });
  const accountChanges: Record<string, number | null> = {};
  const unavailableAccounts: string[] = [];
  const starts = new Map(
    previous.balances.map((balance) => [balance.account.id, balance]),
  );
  const ends = new Map(
    current.balances.map((balance) => [balance.account.id, balance]),
  );
  for (const account of input.ledger.accounts) {
    const start =
      starts.get(account.id) ??
      projectAccountBalance({
        ledger: input.ledger,
        account,
        through: previousDate + " 23:59:59",
      });
    const end =
      ends.get(account.id) ??
      projectAccountBalance({
        ledger: input.ledger,
        account,
        through: input.date + " 23:59:59",
      });
    accountChanges[account.id] =
      start.baseline && end.baseline
        ? addMinor(end.balance, -start.balance)
        : null;
    if (!account.isArchived && accountChanges[account.id] === null)
      unavailableAccounts.push(account.name);
  }
  return {
    previousDate,
    netChange:
      unavailableAccounts.length ||
      current.missingCurrencies.length ||
      previous.missingCurrencies.length ||
      !current.balances.length
        ? null
        : addMinor(current.netAssets, -previous.netAssets),
    accountChanges,
    unavailableAccounts,
  };
}
