import { useMemo } from "react";
import {
  assetComparisonDate,
  compareAssets,
  summarizeAssets,
  type Ledger,
} from "@hamster-ledger/core";
import {
  useExchangeRates,
  type ExchangeRatesController,
} from "./useExchangeRates.js";
import type { NetworkClient } from "./network-model.js";

export interface AssetSummaryController {
  totals: ReturnType<typeof summarizeAssets>;
  comparison: ReturnType<typeof compareAssets>;
  rates: ExchangeRatesController;
}

export function useAssetSummary(input: {
  ledger: Ledger;
  date: string;
  client: NetworkClient;
}): AssetSummaryController {
  const currencies = input.ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => account.currency ?? "CNY");
  const rates = useExchangeRates({
    client: input.client,
    currencies,
    date: input.date,
  });
  const previousRates = useExchangeRates({
    client: input.client,
    currencies,
    date: assetComparisonDate(input.date),
  });
  const totals = useMemo(
    () =>
      summarizeAssets({
        ledger: input.ledger,
        through: input.date + " 23:59:59",
        rates: rates.rates,
      }),
    [input.ledger, input.date, rates.rates],
  );
  const comparison = useMemo(
    () =>
      compareAssets({
        ledger: input.ledger,
        date: input.date,
        currentRates: rates.rates,
        previousRates: previousRates.rates,
      }),
    [input.ledger, input.date, rates.rates, previousRates.rates],
  );
  return { totals, comparison, rates };
}
