import { expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  archiveAssetAccount,
  summarizeAssets,
  saveAssetAccount,
  validateFinancialIntegrity,
  type Ledger,
} from "@hamster-ledger/core";
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  accounts: [
    {
      id: "cash",
      name: "虚拟现金",
      type: "现金",
      kind: "asset",
      openingBalance: 10000,
      balanceAt: "2026-01-01 00:00:00",
      aliases: [],
      checkpoints: [],
      isArchived: false,
    },
  ],
};
const total = (book: Ledger, through: string) =>
  summarizeAssets({ ledger: book, through, rates: [] }).netAssets;
it("preserves pre-archive net worth across archive, restore and rename", () => {
  const archived = archiveAssetAccount({
    ledger,
    accountId: "cash",
    isArchived: true,
    at: "2026-03-01 00:00:00",
  });
  expect(total(archived, "2026-02-28 23:59:59")).toBe(10000);
  expect(total(archived, "2026-03-01 00:00:00")).toBe(0);
  const restored = archiveAssetAccount({
    ledger: archived,
    accountId: "cash",
    isArchived: false,
    at: "2026-04-01 00:00:00",
  });
  expect(total(restored, "2026-03-15 23:59:59")).toBe(0);
  expect(total(restored, "2026-04-01 00:00:00")).toBe(10000);
  const renamed = saveAssetAccount({
    ledger: restored,
    account: { ...ledger.accounts[0], name: "虚拟备用金" },
    now: "2026-04-02 00:00:00",
    checkpointId: "checkpoint",
    note: "",
  });
  expect(renamed.accounts[0].archiveHistory).toEqual(
    restored.accounts[0].archiveHistory,
  );
});
it("retains legacy archive behavior without inventing a historical date", () => {
  const archived = {
    ...ledger,
    accounts: [{ ...ledger.accounts[0], isArchived: true }],
  };
  expect(total(archived, "2026-02-01 00:00:00")).toBe(0);
  const restored = archiveAssetAccount({
    ledger: archived,
    accountId: "cash",
    isArchived: false,
    at: "2026-04-01 00:00:00",
  });
  expect(total(restored, "2026-02-01 00:00:00")).toBe(0);
});
it("rejects historical aggregate overflow even when the accounts are now archived", () => {
  const large: Ledger = {
    ...ledger,
    accounts: [
      ledger.accounts[0],
      { ...ledger.accounts[0], id: "second", name: "另一账户" },
    ].map((account) => ({
      ...account,
      openingBalance: Number.MAX_SAFE_INTEGER,
      isArchived: true,
      archiveHistory: [{ at: "2026-03-01 00:00:00", isArchived: true }],
    })),
  };
  expect(() => validateFinancialIntegrity(large)).toThrow();
});
