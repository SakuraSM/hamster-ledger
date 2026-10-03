import { describe, it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  ledgerSchema,
  summarizeAssets,
  projectAccountBalance,
  saveAssetAccount,
  archiveAssetAccount,
  resolveAssetAccount,
  resolveReview,
  planImport,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";

function account(input: Partial<AssetAccount> = {}): AssetAccount {
  return {
    id: "bank",
    name: "工资卡",
    kind: "asset",
    type: "银行卡",
    openingBalance: 100000,
    balanceAt: "2026-09-01 00:00:00",
    aliases: ["招商银行 · 6628"],
    isArchived: false,
    checkpoints: [],
    ...input,
  };
}
function record(input: Partial<BillRecord> = {}): BillRecord {
  return {
    id: "expense",
    date: "2026-09-10 12:00:00",
    merchant: "商户",
    description: "消费",
    amount: 5000,
    currency: "CNY",
    kind: "支出",
    category: "其他",
    source: "支付宝",
    account: "招商银行 · 6628",
    orderId: "order",
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "virtual.csv",
    raw: {},
    linkedSources: [],
    ...input,
  };
}
const THROUGH = "2026-10-01 00:00:00";
function ledger(input: Partial<Ledger> = {}): Ledger {
  return { ...EMPTY_LEDGER, accounts: [account()], ...input };
}

describe("asset balance and account linkage", () => {
  it("uses an explicit balance baseline and only confirmed movements after it", () => {
    const book = ledger({
      records: [
        record(),
        record({ id: "income", kind: "收入", amount: 20000 }),
        record({ id: "refund", kind: "退款", amount: 2000 }),
        record({ id: "old", date: "2026-08-31 00:00:00" }),
        record({ id: "duplicate", status: "duplicate", amount: 99999 }),
        record({ id: "pending", status: "pending" }),
        record({ id: "future", date: "2026-10-02 00:00:00" }),
      ],
    });
    expect(
      projectAccountBalance({
        account: book.accounts[0],
        ledger: book,
        through: THROUGH,
      }).balance,
    ).toBe(117000);
  });
  it("never guesses the funding account from the payment platform", () => {
    const book = ledger({
      accounts: [account({ name: "支付宝", aliases: ["支付宝余额"] })],
      records: [record()],
    });
    expect(summarizeAssets({ ledger: book, through: THROUGH }).assets).toBe(
      100000,
    );
  });
  it("allows manual unlinking even when a source label matches", () => {
    expect(
      resolveAssetAccount(record({ accountId: null }), [account()]),
    ).toBeUndefined();
  });
  it("increases liability on spending and reduces it on refund", () => {
    const debt = account({
      id: "credit",
      name: "信用卡",
      kind: "liability",
      type: "信用卡",
      openingBalance: 50000,
      aliases: ["信用卡"],
    });
    const book = ledger({
      accounts: [debt],
      records: [
        record({ accountId: "credit", amount: 10000 }),
        record({
          id: "refund",
          accountId: "credit",
          kind: "退款",
          amount: 2000,
        }),
      ],
    });
    expect(summarizeAssets({ ledger: book, through: THROUGH })).toMatchObject({
      assets: 0,
      liabilities: 58000,
      netAssets: -58000,
    });
  });
  it("handles repayments as transfers without changing net worth", () => {
    const debt = account({
      id: "credit",
      name: "信用卡",
      kind: "liability",
      type: "信用卡",
      openingBalance: 50000,
      aliases: [],
    });
    const book = ledger({
      accounts: [account(), debt],
      records: [
        record({
          kind: "转账",
          amount: 20000,
          accountId: "bank",
          transferToAccountId: "credit",
        }),
      ],
    });
    expect(summarizeAssets({ ledger: book, through: THROUGH })).toMatchObject({
      assets: 80000,
      liabilities: 30000,
      netAssets: 50000,
    });
  });
  it("does not move balances for an incomplete transfer", () => {
    const book = ledger({
      records: [record({ kind: "转账", accountId: "bank" })],
    });
    expect(summarizeAssets({ ledger: book, through: THROUGH }).assets).toBe(
      100000,
    );
  });
  it("counts credit-card prepayment as an asset rather than negative debt", () => {
    const book = ledger({
      accounts: [
        account({ kind: "liability", type: "信用卡", openingBalance: -3000 }),
      ],
    });
    expect(summarizeAssets({ ledger: book, through: THROUGH })).toMatchObject({
      assets: 3000,
      liabilities: 0,
      netAssets: 3000,
    });
  });
  it("merges multiple sources into one balance movement", () => {
    const book = planImport(ledger(), [
      record(),
      record({ id: "bank-source", source: "招商银行", orderId: "bank-order" }),
    ]).ledger;
    const resolved = resolveReview({
      ledger: book,
      review: book.reviews[0],
      decision: "linked",
    });
    expect(summarizeAssets({ ledger: resolved, through: THROUGH }).assets).toBe(
      95000,
    );
  });
  it("retains the linked account when the discarded bank record has the explicit link", () => {
    const book = ledger({
      records: [
        record({ accountId: undefined }),
        record({ id: "bank-source", source: "招商银行", accountId: "bank" }),
      ],
      reviews: [
        {
          id: "review",
          leftId: "expense",
          rightId: "bank-source",
          state: "pending",
          reasons: [],
        },
      ],
    });
    expect(
      resolveReview({
        ledger: book,
        review: book.reviews[0],
        decision: "linked",
      }).records[0].accountId,
    ).toBe("bank");
  });
  it("blocks merging records that reference different managed accounts", () => {
    const book = ledger({
      records: [
        record({ accountId: "bank" }),
        record({ id: "other", accountId: "other" }),
      ],
    });
    expect(() =>
      resolveReview({
        ledger: book,
        review: {
          id: "review",
          leftId: "expense",
          rightId: "other",
          state: "pending",
          reasons: [],
        },
        decision: "linked",
      }),
    ).toThrow("不同资产账户");
  });
  it("recalibrates from the new baseline without adding historical transactions twice", () => {
    const book = ledger({ records: [record()] });
    const next = saveAssetAccount({
      ledger: book,
      account: account({
        openingBalance: 95000,
        balanceAt: "2026-09-30 00:00:00",
      }),
      now: THROUGH,
      checkpointId: "checkpoint",
      note: "对账校准",
    });
    expect(summarizeAssets({ ledger: next, through: THROUGH }).assets).toBe(
      95000,
    );
    expect(next.accounts[0].checkpoints[0].note).toBe("对账校准");
  });
  it("preserves historical record links after changing an account name and alias", () => {
    const next = saveAssetAccount({
      ledger: ledger({ records: [record()] }),
      account: account({ name: "新工资卡", aliases: ["新的账户标识"] }),
      now: THROUGH,
      checkpointId: "checkpoint",
      note: "",
    });
    expect(next.records[0].accountId).toBe("bank");
    expect(summarizeAssets({ ledger: next, through: THROUGH }).assets).toBe(
      95000,
    );
  });
  it("archives accounts without deleting record links", () => {
    const next = archiveAssetAccount({
      ledger: ledger({ records: [record()] }),
      accountId: "bank",
      isArchived: true,
    });
    expect(next.records[0].accountId).toBe("bank");
    expect(summarizeAssets({ ledger: next, through: THROUGH }).netAssets).toBe(
      0,
    );
  });
  it("rejects ambiguous aliases and future balance baselines", () => {
    expect(() =>
      saveAssetAccount({
        ledger: ledger(),
        account: account({ id: "other" }),
        now: THROUGH,
        checkpointId: "checkpoint",
        note: "",
      }),
    ).toThrow("别名");
    expect(() =>
      saveAssetAccount({
        ledger: ledger(),
        account: account({ balanceAt: "2026-10-02 00:00:00" }),
        now: THROUGH,
        checkpointId: "checkpoint",
        note: "",
      }),
    ).toThrow("不能晚于");
  });
  it("reads existing ledgers with no asset fields as an empty account collection", () => {
    const { accounts: ignored, ...old } = EMPTY_LEDGER;
    void ignored;
    expect(ledgerSchema.parse(old).accounts).toEqual([]);
  });
});
