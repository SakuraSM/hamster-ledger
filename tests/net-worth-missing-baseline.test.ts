import { expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  migrateLedger,
  netWorthSeries,
  netWorthRangeStart,
} from "@hamster-ledger/core";

it("does not show a partial net worth as complete before every active account has a baseline", () => {
  const ledger = migrateLedger({
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "known",
        name: "已建立基准",
        kind: "asset",
        type: "银行卡",
        openingBalance: 100000,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        checkpoints: [],
        isArchived: false,
      },
      {
        id: "later",
        name: "稍后建立基准",
        kind: "asset",
        type: "银行卡",
        openingBalance: 50000,
        balanceAt: "2026-03-01 00:00:00",
        aliases: [],
        checkpoints: [],
        isArchived: false,
      },
    ],
  });
  const rows = netWorthSeries(ledger, ["2026-02-28", "2026-03-31"], {});
  expect(rows[0]).toMatchObject({
    amount: null,
    missingBaselines: ["稍后建立基准"],
  });
  expect(rows[1].amount).toBe(150000);
});

it("uses calendar-month range boundaries across year and leap-day transitions", () => {
  expect(netWorthRangeStart({ end: "2026-01-31", months: 3 })).toBe(
    "2025-11-01",
  );
  expect(netWorthRangeStart({ end: "2024-02-29", months: 1 })).toBe(
    "2024-02-01",
  );
  expect(() => netWorthRangeStart({ end: "2024-02-29", months: 0 })).toThrow();
});
