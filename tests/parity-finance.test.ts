import { describe, it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  convertToCny,
  parseMinor,
  migrateLedger,
  createLedgerRepository,
  saveAdvancedEntry,
  splitAmount,
  summarize,
  summarizeAssets,
  type Ledger,
  type AdvancedEntryInput,
  type AssetAccount,
} from "@hamster-ledger/core";

const account = (
  id: string,
  kind: "asset" | "liability" = "asset",
): AssetAccount => ({
  id,
  name: id,
  kind,
  type: kind === "asset" ? "银行卡" : "贷款",
  openingBalance: 0,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
});
const ledger = (): Ledger => ({
  ...EMPTY_LEDGER,
  accounts: [
    account("cash"),
    account("receivable"),
    account("payable", "liability"),
  ],
});
function entry(
  overrides: Partial<AdvancedEntryInput> = {},
): AdvancedEntryInput {
  return {
    id: "one",
    date: "2026-10-03 12:00:00",
    merchant: "虚拟餐馆",
    category: "餐饮",
    accountId: "cash",
    detail: {
      type: "expense",
      original: {
        minor: 10001,
        currency: "CNY",
        rate: "1",
        date: "2026-10-03",
        source: "manual",
      },
      attachmentIds: [],
      splits: [],
      movements: [],
      origin: "manual",
    },
    ...overrides,
  };
}
describe("v2 money and migration", () => {
  it("uses integer arithmetic for half-cent and currencies with zero decimals", () => {
    expect(convertToCny({ minor: 1, currency: "USD", rate: "7.125" })).toBe(7);
    expect(convertToCny({ minor: 2, currency: "USD", rate: "7.125" })).toBe(14);
    expect(convertToCny({ minor: -1, currency: "USD", rate: "7.5" })).toBe(-8);
    expect(convertToCny({ minor: 101, currency: "JPY", rate: "0.05" })).toBe(
      505,
    );
    expect(parseMinor({ value: "12.34", currency: "CNY" })).toBe(1234);
    expect(() => parseMinor({ value: "12.5", currency: "JPY" })).toThrow();
    expect(() =>
      convertToCny({
        minor: Number.MAX_SAFE_INTEGER,
        currency: "USD",
        rate: "99",
      }),
    ).toThrow();
  });
  it("preserves IDs and totals and is idempotent", () => {
    const before = saveAdvancedEntry(ledger(), entry());
    const migrated = migrateLedger({ ...before, version: 1 });
    expect(migrated.version).toBe(2);
    expect(summarize(migrated.records)).toEqual(summarize(before.records));
    expect(migrated.accounts.map((item) => item.id)).toEqual(
      before.accounts.map((item) => item.id),
    );
    expect(migrateLedger(migrated)).toEqual(migrated);
    expect(() => migrateLedger({ ...before, version: 3 })).toThrow();
  });
  it("retains the v1 source if backup or migration persistence fails", async () => {
    const raw = JSON.stringify(ledger());
    const entries = new Map([["hamster-ledger.v1.personal", raw]]);
    const repository = createLedgerRepository({
      getItem: async (key) => entries.get(key) ?? null,
      setItem: async () => {
        throw new Error("disk full");
      },
    });
    const migrated = await repository.load("personal");
    expect(migrated?.version).toBe(2);
    await expect(repository.save("personal", migrated!)).rejects.toThrow(
      "disk full",
    );
    expect(entries.get("hamster-ledger.v1.personal")).toBe(raw);
  });
});
describe("advanced transaction accounting", () => {
  it("keeps lending and repayment neutral for income and net assets", () => {
    const lending = entry({ transferToAccountId: "receivable" });
    lending.detail.type = "lend";
    const next = saveAdvancedEntry(ledger(), lending);
    expect(summarize(next.records)).toEqual({ income: 0, expense: 0, net: 0 });
    expect(
      summarizeAssets({ ledger: next, through: "2026-10-04 00:00:00" })
        .netAssets,
    ).toBe(0);
    const repayment = entry({
      id: "two",
      accountId: "receivable",
      transferToAccountId: "cash",
    });
    repayment.detail.type = "repay_receive";
    expect(
      summarizeAssets({
        ledger: saveAdvancedEntry(next, repayment),
        through: "2026-10-04 00:00:00",
      }).balances.every((item) => item.balance === 0),
    ).toBe(true);
  });
  it("reduces expense for partial reimbursement and rejects overpayment", () => {
    const expense = saveAdvancedEntry(ledger(), entry());
    const reimbursement = entry({ id: "two" });
    reimbursement.detail = {
      ...reimbursement.detail,
      type: "reimburse",
      relatedId: "one",
      original: { ...reimbursement.detail.original, minor: 3000 },
    };
    const next = saveAdvancedEntry(expense, reimbursement);
    expect(summarize(next.records)).toEqual({
      income: 0,
      expense: 7001,
      net: -7001,
    });
    reimbursement.id = "three";
    reimbursement.detail.original.minor = 8000;
    expect(() => saveAdvancedEntry(next, reimbursement)).toThrow("累计金额");
  });
  it("distributes indivisible cents deterministically without losing money", () => {
    expect(
      splitAmount({
        amount: 100,
        members: [
          { id: "a", weight: 1 },
          { id: "b", weight: 1 },
          { id: "c", weight: 1 },
        ],
      }),
    ).toEqual([
      { memberId: "a", amount: 34 },
      { memberId: "b", amount: 33 },
      { memberId: "c", amount: 33 },
    ]);
    const invalid = entry();
    invalid.detail.splits = [{ memberId: "a", amount: 10 }];
    expect(() => saveAdvancedEntry(ledger(), invalid)).toThrow("合计");
  });
});
