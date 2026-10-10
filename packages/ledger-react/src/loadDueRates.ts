import type { Currency, ExchangeRate } from "@hamster-ledger/core";
import type { NetworkClient } from "./network-model.js";
import { requestExchangeRate } from "./useExchangeRates.js";
export async function loadDueRates(
  client: NetworkClient,
  requests: Array<{ currency: Currency; date: string }>,
): Promise<ExchangeRate[]> {
  const rates: ExchangeRate[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, requests.length) }, async () => {
      while (cursor < requests.length) {
        const request = requests[cursor++];
        try {
          const rate = await requestExchangeRate(
            client,
            request.currency,
            request.date,
          );
          if (!rate.needsConfirmation) rates.push(rate);
        } catch {
          /* Missing rates leave this occurrence pending; the notification center explains it. */
        }
      }
    }),
  );
  return rates;
}
