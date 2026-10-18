import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  accountActivity,
  compareAssets,
  projectAccountBalance,
  saveAssetAccount,
  linkedAccountRecords,
  assetTrendStart,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";

const bank: AssetAccount = {
  id: "bank",
  name: "工资卡",
  type: "银行卡",
  kind: "asset",
  balanceAt: "2026-09-01 00:00:00",
  openingBalance: 100000,
  isArchived: false,
  aliases: [],
  checkpoints: [],
};
const expense: BillRecord = {
  id: "expense",
  date: "2026-09-10 12:00:00",
  merchant: "咖啡",
  description: "",
  kind: "支出",
  amount: 5000,
  currency: "CNY",
  category: "餐饮",
  source: "手动记账",
  account: "工资卡",
  accountId: "bank",
  status: "confirmed",
  orderId: "",
  fileName: "",
  sourceStatus: "",
  linkedSources: [],
  raw: {},
};
const end = "2026-10-18 23:59:59";
function book(records: BillRecord[] = [expense]): Ledger {
  return { ...EMPTY_LEDGER, accounts: [bank], records };
}

describe("account changes explain projected balances", () => {
  it("shows income, expenses and calibration with a running balance without double counting", () => {
    const ledger = saveAssetAccount({
      ledger: book(),
      account: {
        ...bank,
        openingBalance: 97000,
        balanceAt: "2026-09-20 00:00:00",
      },
      now: end,
      checkpointId: "calibration",
      note: "核对",
    });
    ledger.records.push({
      ...expense,
      id: "salary",
      kind: "收入",
      amount: 10000,
      date: "2026-10-01 12:00:00",
    });
    const rows = accountActivity({
      ledger,
      account: ledger.accounts[0],
      through: end,
    });
    expect(rows.map((row) => [row.kind, row.change, row.balance])).toEqual([
      ["record", 10000, 107000],
      ["calibration", 2000, 97000],
      ["record", -5000, 95000],
      ["opening", null, 100000],
    ]);
    expect(rows[0].balance).toBe(
      projectAccountBalance({
        ledger,
        account: ledger.accounts[0],
        through: end,
      }).balance,
    );
  });
  it("excludes pending, duplicates, deleted, future and pre-baseline records", () => {
    const ledger = book([
      expense,
      { ...expense, id: "pending", status: "pending" },
      { ...expense, id: "duplicate", status: "duplicate" },
      { ...expense, id: "deleted", isDeleted: true },
      { ...expense, id: "future", date: "2027-01-01 12:00:00" },
      { ...expense, id: "old", date: bank.balanceAt },
    ]);
    expect(
      accountActivity({ ledger, account: bank, through: end }).map(
        (row) => row.id,
      ),
    ).toEqual([
      "record:expense",
      `baseline:${bank.id}:baseline:${bank.balanceAt}`,
    ]);
  });
  it("orders movements before a calibration at the same time and keeps the latest replacement", () => {
    let ledger = saveAssetAccount({
      ledger: book(),
      account: { ...bank, balanceAt: expense.date, openingBalance: 97000 },
      now: end,
      checkpointId: "first",
      note: "核对",
    });
    ledger = saveAssetAccount({
      ledger,
      account: { ...ledger.accounts[0], openingBalance: 98000 },
      now: end,
      checkpointId: "replacement",
      note: "更正",
    });
    const rows = accountActivity({
      ledger,
      account: ledger.accounts[0],
      through: end,
    });
    expect(rows.map((row) => row.balance)).toEqual([98000, 95000, 100000]);
    expect(rows[0]).toMatchObject({ change: 3000, description: "更正" });
    expect(
      projectAccountBalance({
        ledger,
        account: ledger.accounts[0],
        through: end,
      }).balance,
    ).toBe(98000);
  });
  it("repayments reduce both bank assets and credit debt without net worth gains", () => {
    const debt: AssetAccount = {
      ...bank,
      id: "credit",
      name: "信用卡",
      type: "信用卡",
      kind: "liability",
      openingBalance: 50000,
    };
    const ledger: Ledger = {
      ...book([
        {
          ...expense,
          date: "2026-10-10 00:00:00",
          kind: "转账",
          transferToAccountId: "credit",
          amount: 20000,
        },
      ]),
      accounts: [bank, debt],
    };
    expect(
      accountActivity({ ledger, account: debt, through: end })[0],
    ).toMatchObject({ change: -20000, balance: 30000 });
    expect(
      compareAssets({
        ledger,
        date: "2026-10-18",
        currentRates: [],
        previousRates: [],
      }),
    ).toMatchObject({
      netChange: 0,
      accountChanges: { bank: -20000, credit: -20000 },
    });
  });
  it("does not report a new account baseline as monthly income or a zero starting value", () => {
    const account = { ...bank, balanceAt: "2026-10-10 00:00:00" };
    const ledger = { ...book([]), accounts: [account] };
    expect(
      compareAssets({
        ledger,
        date: "2026-10-18",
        currentRates: [],
        previousRates: [],
      }),
    ).toMatchObject({
      netChange: null,
      accountChanges: { bank: null },
      unavailableAccounts: ["工资卡"],
    });
    expect(
      projectAccountBalance({ ledger, account, through: "2026-10-01 00:00:00" })
        .baseline,
    ).toBeNull();
    expect(assetTrendStart({ ledger, end: "2026-10-18" })).toBe("2026-10-10");
  });
  it("leaves net change unknown when historical FX is missing while preserving original-currency changes", () => {
    const ledger = {
      ...book([]),
      accounts: [{ ...bank, currency: "USD" as const }],
    };
    expect(
      compareAssets({
        ledger,
        date: "2026-10-18",
        currentRates: [
          { currency: "USD", date: "2026-10-18", rate: "7", source: "manual" },
        ],
        previousRates: [],
      }),
    ).toMatchObject({ netChange: null, accountChanges: { bank: 0 } });
  });
  it("keeps advanced movements visible even when only their movement references the account", () => {
    const record: BillRecord = {
      ...expense,
      accountId: null,
      account: "",
      detail: {
        type: "adjust",
        movements: [{ accountId: "bank", amount: 2000 }],
        original: {
          currency: "CNY",
          minor: 2000,
          rate: "1",
          date: "2026-09-10",
          source: "manual",
        },
        splits: [],
        attachmentIds: [],
        origin: "manual",
      },
    };
    const ledger = book([record]);
    expect(
      linkedAccountRecords({
        records: [record],
        accounts: [bank],
        accountId: "bank",
      }),
    ).toHaveLength(1);
    expect(
      accountActivity({ ledger, account: bank, through: end })[0],
    ).toMatchObject({ change: 2000, balance: 102000 });
  });
});
