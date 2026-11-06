import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { saveAssetAccount } from "../packages/ledger-core/src/asset-actions";

const account: AssetAccount = {
  id: "card",
  name: "信用卡",
  kind: "liability",
  type: "信用卡",
  currency: "CNY",
  creditLimit: 100000,
  openingBalance: 20000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: ["旧别名"],
  isArchived: false,
  checkpoints: [],
};
const ledger: Ledger = { ...EMPTY_LEDGER, accounts: [account] };
const saveInput = {
  now: "2026-11-06 12:00:00",
  checkpointId: "checkpoint",
  note: "",
};

describe("asset account optimistic editing", () => {
  it("rejects stale account edits without overwriting a newer limit or alias", () => {
    const latest: Ledger = {
      ...ledger,
      accounts: [{ ...account, creditLimit: 200000, aliases: ["新别名"] }],
    };
    expect(() =>
      saveAssetAccount({
        ...saveInput,
        ledger: latest,
        account: { ...account, name: "更名" },
        expectedAccount: account,
      }),
    ).toThrow("账户已发生变化");
    expect(latest.accounts[0].creditLimit).toBe(200000);
    expect(latest.accounts[0].aliases).toEqual(["新别名"]);
    expect(latest.accounts[0].name).toBe("信用卡");
  });

  it("rejects a missing or replaced original account", () => {
    expect(() =>
      saveAssetAccount({
        ...saveInput,
        ledger: { ...ledger, accounts: [] },
        account,
        expectedAccount: account,
      }),
    ).toThrow("账户已发生变化");
    expect(() =>
      saveAssetAccount({
        ...saveInput,
        ledger,
        account,
        expectedAccount: { ...account, id: "another" },
      }),
    ).toThrow("账户已发生变化");
  });

  it("treats null as a new account and rejects an ID that appeared later", () => {
    expect(() =>
      saveAssetAccount({
        ...saveInput,
        ledger,
        account,
        expectedAccount: null,
      }),
    ).toThrow("账户已发生变化");
    const created = saveAssetAccount({
      ...saveInput,
      ledger: { ...ledger, accounts: [] },
      account,
      expectedAccount: null,
    });
    expect(created.accounts[0].id).toBe(account.id);
  });

  it("allows a structurally unchanged account and retains legacy no-expectation calls", () => {
    const { id, ...remaining } = account;
    const expected = {
      ...remaining,
      id,
      aliases: [...account.aliases],
      checkpoints: [],
    };
    const saved = saveAssetAccount({
      ...saveInput,
      ledger,
      account: { ...account, name: "新名称" },
      expectedAccount: expected,
    });
    expect(saved.accounts[0].name).toBe("新名称");
    const legacy = saveAssetAccount({
      ...saveInput,
      ledger,
      account: { ...account, name: "旧调用" },
    });
    expect(legacy.accounts[0].name).toBe("旧调用");
  });
});
