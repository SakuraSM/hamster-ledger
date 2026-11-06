import { expect, it } from "vitest";
import {
  compareAssets,
  saveEntry,
  saveAssetAccount,
  summarize,
  summarizeAssets,
} from "@hamster-ledger/core";
import {
  ASSET_ACCOUNTS,
  ASSET_TOTALS,
  NET_ASSETS,
  PERIOD_ASSET_CHANGE,
} from "../apps/web/src/design-preview/asset-fixture";
import {
  ASSET_CAPTURE_THROUGH,
  createDesignAssetLedger,
} from "../apps/web/src/design-preview/finance-fixture";
it("all asset figures in the visual draft follow the real ledger projection and monthly comparison", () => {
  const ledger = createDesignAssetLedger();
  const totals = summarizeAssets({
    ledger,
    through: ASSET_CAPTURE_THROUGH,
    rates: [],
  });
  expect(totals.assets).toBe(ASSET_TOTALS.assets);
  expect(totals.liabilities).toBe(ASSET_TOTALS.liabilities);
  expect(totals.netAssets).toBe(NET_ASSETS);
  expect(totals.missingBaselines).toEqual([]);
  for (const account of ASSET_ACCOUNTS)
    expect(
      totals.balances.find((balance) => balance.account.id === account.id)
        ?.balance,
    ).toBe(account.minor);
  expect(
    compareAssets({
      ledger,
      date: "2026-11-06",
      currentRates: [],
      previousRates: [],
    }).netChange,
  ).toBe(PERIOD_ASSET_CHANGE);
  expect(summarize(ledger.records)).toMatchObject({
    income: 850000,
    expense: 128640,
    net: 721360,
  });
});
it("the 500-yuan credit repayment draft preserves net worth and does not create expense", () => {
  const before = createDesignAssetLedger();
  const after = saveEntry(before, {
    id: "repayment",
    date: "2026-11-06 17:00:00",
    merchant: "信用卡还款",
    amount: 50000,
    kind: "转账",
    category: "其他",
    description: "合成设计样本",
    tags: [],
    accountId: "bank",
    transferToAccountId: "credit",
  });
  const totals = summarizeAssets({
    ledger: after,
    through: ASSET_CAPTURE_THROUGH,
    rates: [],
  });
  expect(totals.netAssets).toBe(NET_ASSETS);
  expect(
    totals.balances.find((balance) => balance.account.id === "bank")?.balance,
  ).toBe(2550000);
  expect(
    totals.balances.find((balance) => balance.account.id === "credit")?.balance,
  ).toBe(200000);
  expect(summarize(after.records)).toEqual(summarize(before.records));
});
it("the calibration draft keeps history and changes the baseline without inventing an expense", () => {
  const before = createDesignAssetLedger(),
    account = before.accounts.find((item) => item.id === "cash")!;
  const after = saveAssetAccount({
    ledger: before,
    account: {
      ...account,
      openingBalance: 318000,
      balanceAt: "2026-11-06 17:30:00",
    },
    now: ASSET_CAPTURE_THROUGH,
    checkpointId: "design-calibration",
    note: "现金盘点，核对实际差额",
  });
  expect(
    summarizeAssets({
      ledger: after,
      through: ASSET_CAPTURE_THROUGH,
      rates: [],
    }).netAssets,
  ).toBe(2840000);
  const historical = summarizeAssets({
    ledger: after,
    through: "2026-11-05 23:59:59",
    rates: [],
  });
  expect(
    historical.balances.find((balance) => balance.account.id === "cash")
      ?.balance,
  ).toBe(325600);
  expect(after.records).toEqual(before.records);
});
it("archive visuals exclude the account now but preserve the earlier net-worth range", async () => {
  const { archiveAssetAccount } = await import("@hamster-ledger/core");
  const ledger = archiveAssetAccount({
    ledger: createDesignAssetLedger(),
    accountId: "cash",
    isArchived: true,
    at: "2026-11-06 17:30:00",
  });
  expect(
    summarizeAssets({ ledger, through: ASSET_CAPTURE_THROUGH, rates: [] })
      .netAssets,
  ).toBe(2522000);
  expect(
    summarizeAssets({ ledger, through: "2026-11-05 23:59:59", rates: [] })
      .netAssets,
  ).toBe(2847600);
});
