import { useEffect, useRef, useState } from "react";
import {
  exchangeRateSchema,
  type Currency,
  type ExchangeRate,
} from "@hamster-ledger/core";
import type { NetworkClient } from "./network-model.js";
export interface RateQuote extends ExchangeRate {
  isCached?: boolean;
  needsConfirmation?: boolean;
}
export async function requestExchangeRate(
  client: NetworkClient,
  currency: Currency,
  date: string,
): Promise<RateQuote> {
  const value = await client.request<RateQuote>(
    `/fx?currency=${currency}&date=${date}`,
  );
  const parsed = exchangeRateSchema.parse(value);
  if (parsed.currency !== currency || parsed.date > date)
    throw new Error("参考汇率的币种或日期不匹配。");
  return {
    ...parsed,
    requestedDate: date,
    isCached: value.isCached,
    needsConfirmation: value.needsConfirmation,
  };
}
export interface ExchangeRatesController {
  rates: RateQuote[];
  error: string;
  isLoading: boolean;
  setManual: (currency: Currency, rate: string) => void;
}
export function useExchangeRates(input: {
  client: NetworkClient;
  currencies: Currency[];
  date: string;
}): ExchangeRatesController {
  const [rates, setRates] = useState<RateQuote[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(false);
  const current = useRef(input);
  current.current = input;
  const key = `${input.date}:${[...new Set(input.currencies)].sort().join(",")}`;
  useEffect(() => {
    let canceled = false;
    const { date, client, currencies } = current.current;
    setRates([]);
    setError("");
    setLoading(true);
    void Promise.allSettled(
      [...new Set(currencies)]
        .filter((currency) => currency !== "CNY")
        .map((currency) => requestExchangeRate(client, currency, date)),
    ).then((results) => {
      if (canceled) return;
      setRates(
        results
          .filter(
            (result) =>
              result.status === "fulfilled" && !result.value.needsConfirmation,
          )
          .map((result) => (result as PromiseFulfilledResult<RateQuote>).value),
      );
      if (
        results.some(
          (result) =>
            result.status === "rejected" || result.value.needsConfirmation,
        )
      )
        setError("部分参考汇率暂不可用，请为缺少的币种手动填写估值汇率。");
      setLoading(false);
    });
    return () => {
      canceled = true;
    };
  }, [key]);
  return {
    rates,
    error,
    isLoading,
    setManual(currency, rate) {
      try {
        const value = exchangeRateSchema.parse({
          currency,
          rate,
          date: input.date,
          source: "manual",
        });
        setRates((previous) => [
          ...previous.filter((item) => item.currency !== currency),
          value,
        ]);
        setError("");
      } catch {
        setError("汇率必须为大于零的数字。");
      }
    },
  };
}
