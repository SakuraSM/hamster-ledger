import { expect, it } from "vitest";
import {
  assetAccountSchema,
  allocationRows,
  allocationGroups,
  accountIcon,
  summarizeAssets,
  EMPTY_LEDGER,
  netWorthSeries,
  statementMonths,
  reportWeekStart,
  type AssetAccount,
  type Ledger,
  type ExchangeRate,
} from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";
function account(
  id: string,
  amount: number,
  changes: Partial<AssetAccount> = {},
): AssetAccount {
  return assetAccountSchema.parse({
    id,
    name: id,
    kind: "asset",
    type: "现金",
    openingBalance: amount,
    balanceAt: "2026-01-01 00:00:00",
    ...changes,
  });
}
it("uses the same CNY sign, date and FX boundaries for allocation and valuation", () => {
  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [
      account("USD", 10000, { currency: "USD" }),
      account("预存", -5000, { kind: "liability", type: "信用卡" }),
      account("透支", -2000),
      account("EUR", 100, { currency: "EUR" }),
      account("未来", 350, { balanceAt: "2027-01-01 00:00:00" }),
    ],
  };
  const date = "2026-11-23",
    rates: ExchangeRate[] = [
      { currency: "USD", date, rate: "7", source: "manual" },
      { currency: "USD", date: "2026-11-24", rate: "8", source: "manual" },
    ];
  const t = summarizeAssets({ ledger, through: date + " 23:59:59", rates });
  expect(t.assets).toBe(75000);
  expect(t.liabilities).toBe(2000);
  expect(allocationGroups(allocationRows(t.balances))).toEqual([
    { label: "现金", value: 70000 },
    { label: "信用卡", value: 5000 },
  ]);
  expect(allocationRows(t.balances, true).map((x) => x.account.id)).toEqual([
    "透支",
  ]);
  expect(
    netWorthSeries(ledger, [date], { [date]: rates }, "assets")[0].amount,
  ).toBeNull();
  const complete = { ...ledger, accounts: ledger.accounts.slice(0, 3) };
  expect(
    netWorthSeries(complete, [date], { [date]: rates }, "liabilities")[0]
      .amount,
  ).toBe(2000);
});
it("loads old accounts and round-trips a visual override without changing their type", () => {
  const a = account("test", 420);
  expect(accountIcon(a)).toBe("cash");
  const b = assetAccountSchema.parse({ ...a, icon: "travel" });
  expect(accountIcon(b)).toBe("travel");
  expect(b.type).toBe(a.type);
});
it("assigns month statements using the book cycle and excludes transfers and unconfirmed records", () => {
  const demo = createDemoLedger(),
    record = demo.records[0];
  const ledger = {
    ...demo,
    preferences: { ...demo.preferences!, cycleStartDay: 10 },
    records: [
      {
        ...record,
        id: "in",
        kind: "收入" as const,
        status: "confirmed" as const,
        amount: 13000,
        date: "2026-09-10 00:00:00",
      },
      {
        ...record,
        id: "out",
        kind: "支出" as const,
        status: "confirmed" as const,
        amount: 4500,
        date: "2026-10-09 23:59:59",
      },
      {
        ...record,
        id: "move",
        kind: "转账" as const,
        status: "confirmed" as const,
        amount: 5500,
        date: "2026-10-01 00:00:00",
      },
      {
        ...record,
        id: "pending",
        kind: "支出" as const,
        status: "pending" as const,
        amount: 500,
        date: "2026-10-02 00:00:00",
      },
    ],
  };
  expect(
    statementMonths(ledger, "2026").find((r) => r.month === "2026-09"),
  ).toMatchObject({ income: 13000, expense: 4500, net: 8500 });
  expect(reportWeekStart("2026-11-22")).toBe("2026-11-16");
});
