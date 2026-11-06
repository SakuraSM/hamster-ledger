import { describe, expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  pendingReviewCount,
  projectAccountBalance,
  resolvePendingRecord,
  summarize,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { editLedgerRecord } from "../packages/ledger-react/src/ledger-actions";

const cash: AssetAccount = {
  id: "cash",
  name: "现金",
  kind: "asset",
  type: "现金",
  openingBalance: 100000,
  balanceAt: "2026-09-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};
const pending: BillRecord = {
  id: "bill",
  date: "2026-09-10 12:00:00",
  merchant: "虚拟支出",
  description: "",
  amount: 5000,
  currency: "CNY",
  kind: "支出",
  category: "其他",
  source: "支付宝",
  account: "现金",
  accountId: cash.id,
  orderId: "virtual",
  status: "pending",
  sourceStatus: "成功",
  fileName: "virtual.csv",
  raw: {},
  linkedSources: [],
  reason: "等待核对",
};
function balance(ledger: Ledger): number {
  return projectAccountBalance({
    account: cash,
    ledger,
    through: "2026-09-30 23:59:59",
  }).balance;
}
function changeCategory(ledger: Ledger, record: BillRecord): Ledger {
  return editLedgerRecord(ledger, {
    id: record.id,
    expectedRecord: record,
    category: "餐饮",
    kind: record.kind,
    account: record.account,
    accountId: record.accountId,
    transferToAccountId: record.transferToAccountId,
    remember: false,
  });
}

describe("metadata changes and explicit review", () => {
  it("keeps an unpaired pending bill outside totals and balances until explicit confirmation", () => {
    const initial: Ledger = {
      ...EMPTY_LEDGER,
      accounts: [cash],
      records: [pending],
    };
    const edited = changeCategory(initial, pending);
    expect(edited.records[0]).toMatchObject({
      status: "pending",
      category: "餐饮",
      reason: "等待核对",
    });
    expect(pendingReviewCount(edited)).toBe(1);
    expect(summarize(edited.records).expense).toBe(0);
    expect(balance(edited)).toBe(100000);

    const confirmed = resolvePendingRecord(edited, {
      record: edited.records[0],
      decision: "confirm",
    });
    expect(confirmed.records[0].status).toBe("confirmed");
    expect(pendingReviewCount(confirmed)).toBe(0);
    expect(summarize(confirmed.records).expense).toBe(5000);
    expect(balance(confirmed)).toBe(95000);
  });

  it.each(["confirmed", "duplicate"] as const)(
    "preserves %s status when editing metadata",
    (status) => {
      const record = { ...pending, status };
      const ledger: Ledger = {
        ...EMPTY_LEDGER,
        accounts: [cash],
        records: [record],
      };
      expect(changeCategory(ledger, record).records[0].status).toBe(status);
    },
  );
});
