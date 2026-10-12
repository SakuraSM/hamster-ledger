import {
  currencySchema,
  dateSchema,
  exchangeRateSchema,
} from "@hamster-ledger/core";
import { json, HttpError } from "./http.mjs";
const TIMEOUT_MS = 8000;
export async function fetchExchangeRate({
  database,
  currency,
  date,
  fetcher = fetch,
}) {
  currencySchema.parse(currency);
  dateSchema.parse(date);
  if (currency === "CNY")
    return { currency, date, rate: "1", source: "manual", isCached: false };
  const exact = await database
    .prepare(
      "SELECT currency,date,rate,source FROM fx_rates WHERE currency=$1 AND date=$2",
    )
    .get(currency, date);
  if (exact) return { ...exact, isCached: true };
  try {
    const response = await fetcher(
      `https://api.frankfurter.dev/v2/rate/${currency}/CNY?date=${date}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" },
    );
    if (!response.ok) throw new Error("汇率服务暂不可用。");
    const value = await response.json();
    if (
      value.base !== currency ||
      value.quote !== "CNY" ||
      typeof value.rate !== "number" ||
      value.date > date
    )
      throw new Error("汇率响应无效。");
    const result = exchangeRateSchema.parse({
      currency,
      date: value.date,
      rate: String(value.rate),
      source: "frankfurter",
    });
    await database
      .prepare(
        "INSERT INTO fx_rates VALUES($1,$2,$3,$4) ON CONFLICT(currency,date) DO UPDATE SET rate=excluded.rate,source=excluded.source",
      )
      .run(result.currency, result.date, result.rate, result.source);
    return { ...result, isCached: false };
  } catch {
    const cached = await database
      .prepare(
        "SELECT currency,date,rate,source FROM fx_rates WHERE currency=$1 AND date<=$2 ORDER BY date DESC LIMIT 1",
      )
      .get(currency, date);
    if (cached) return { ...cached, isCached: true, needsConfirmation: true };
    throw new HttpError(
      503,
      "无法获取参考汇率，请手动填写实际记账汇率。",
      "rate_unavailable",
    );
  }
}
export async function exchangeApi({ database, request, response, now }) {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/api/fx" && url.pathname !== "/api/native/fx")
    return false;
  if (request.method !== "GET")
    throw new HttpError(405, "汇率接口仅支持查询。");
  const currency = currencySchema.safeParse(url.searchParams.get("currency"));
  const date = dateSchema.safeParse(url.searchParams.get("date"));
  if (
    !currency.success ||
    !date.success ||
    date.data > new Date(now()).toISOString().slice(0, 10)
  )
    throw new HttpError(400, "币种或交易日期无效。");
  json(
    response,
    200,
    await fetchExchangeRate({
      database,
      currency: currency.data,
      date: date.data,
    }),
  );
  return true;
}
