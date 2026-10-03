import { useEffect, useState } from "react";
import {
  netWorthDates,
  netWorthSeries,
  type Ledger,
  type ExchangeRate,
} from "@hamster-ledger/core";
import type { NetworkClient } from "./network-model.js";
import { loadDueRates } from "./loadDueRates.js";
export interface NetWorthReport {
  rows: ReturnType<typeof netWorthSeries>;
  isLoading: boolean;
  error: string;
}
export function useReportData(input: {
  ledger: Ledger;
  start: string;
  end: string;
  client: NetworkClient;
}): NetWorthReport {
  const [result, setResult] = useState<{
    key: string;
    rates: Record<string, ExchangeRate[]>;
  }>({ key: "", rates: {} });
  let dates: string[] = [],
    error = "";
  try {
    dates = netWorthDates(input.start, input.end);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "日期无效。";
  }
  const currencies = [
    ...new Set(
      input.ledger.accounts
        .filter((item) => !item.isArchived)
        .map((item) => item.currency ?? "CNY"),
    ),
  ].filter((item) => item !== "CNY");
  const key = JSON.stringify([dates, currencies.sort()]);
  useEffect(() => {
    let canceled = false;
    const [days, units] = JSON.parse(key) as [string[], typeof currencies];
    void loadDueRates(
      input.client,
      days.flatMap((date) => units.map((currency) => ({ currency, date }))),
    ).then((rates) => {
      if (!canceled)
        setResult({
          key,
          rates: Object.fromEntries(
            days.map((date) => [
              date,
              rates.filter((rate) => rate.requestedDate === date),
            ]),
          ),
        });
    });
    return () => {
      canceled = true;
    };
  }, [key, input.client]);
  const rows = netWorthSeries(
    input.ledger,
    dates,
    result.key === key ? result.rates : {},
  );
  return {
    rows,
    error,
    isLoading: currencies.length > 0 && result.key !== key,
  };
}
