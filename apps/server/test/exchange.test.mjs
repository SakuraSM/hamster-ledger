import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { fetchExchangeRate } from "../src/exchange-api.mjs";
test("exchange quotes preserve the actual publication date, cache explicitly and never invent parity", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(
    "CREATE TABLE fx_rates(currency TEXT,date TEXT,rate TEXT,source TEXT,PRIMARY KEY(currency,date))",
  );
  try {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return Response.json({
        base: "USD",
        quote: "CNY",
        date: "2026-10-02",
        rate: 7.1215,
      });
    };
    const quote = await fetchExchangeRate({
      database,
      currency: "USD",
      date: "2026-10-03",
      fetcher,
    });
    assert.equal(quote.date, "2026-10-02");
    assert.equal(quote.rate, "7.1215");
    assert.equal(quote.isCached, false);
    const cached = await fetchExchangeRate({
      database,
      currency: "USD",
      date: "2026-10-02",
      fetcher,
    });
    assert.equal(cached.isCached, true);
    assert.equal(calls, 1);
    const offline = async () => {
      throw new Error("offline");
    };
    const fallback = await fetchExchangeRate({
      database,
      currency: "USD",
      date: "2026-10-03",
      fetcher: offline,
    });
    assert.equal(fallback.needsConfirmation, true);
    await assert.rejects(
      fetchExchangeRate({
        database,
        currency: "USD",
        date: "2026-10-01",
        fetcher: offline,
      }),
      /手动填写/,
    );
    await assert.rejects(
      fetchExchangeRate({
        database,
        currency: "EUR",
        date: "2026-10-03",
        fetcher: async () =>
          Response.json({
            base: "EUR",
            quote: "CNY",
            date: "2026-10-04",
            rate: 1,
          }),
      }),
      /手动填写/,
    );
  } finally {
    database.close();
  }
});
