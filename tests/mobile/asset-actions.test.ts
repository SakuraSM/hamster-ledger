import { describe, expect, it } from "vitest";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { BillRecord } from "@hamster-ledger/core";
import {
  assetTransferDraft,
  unassignedAssetRecords,
} from "../../apps/mobile/src/screens/asset-actions";

const ledger = createDemoLedger();
const asset = ledger.accounts.find((account) => account.kind === "asset")!;
const liability = {
  ...asset,
  id: "credit-card",
  name: "信用卡",
  kind: "liability" as const,
  type: "信用卡" as const,
};

describe("native asset actions", () => {
  it("requires an explicit funding account when starting a card repayment", () => {
    expect(assetTransferDraft(liability)).toEqual({
      type: "transfer",
      accountId: "",
      destinationId: liability.id,
      merchant: "信用卡还款",
    });
  });
  it("uses the selected asset as source and leaves the destination open", () => {
    expect(assetTransferDraft(asset)).toEqual({
      type: "transfer",
      accountId: asset.id,
      destinationId: "",
      merchant: "账户转账",
    });
    expect(assetTransferDraft({ ...liability, type: "贷款" }).merchant).toBe(
      "负债还款",
    );
    expect(assetTransferDraft()).toMatchObject({
      accountId: "",
      destinationId: "",
    });
  });
  it("only reports confirmed, nondeleted unlinked income and expense records", () => {
    const base = ledger.records[0];
    const record = (overrides: Partial<BillRecord>): BillRecord => ({
      ...base,
      detail: undefined,
      accountId: null,
      account: "",
      isDeleted: false,
      status: "confirmed",
      kind: "支出",
      ...overrides,
    });
    const records = [
      record({ id: "unassigned" }),
      record({ id: "linked", accountId: asset.id }),
      record({ id: "pending", status: "pending" }),
      record({ id: "duplicate", status: "duplicate" }),
      record({ id: "deleted", isDeleted: true }),
      record({ id: "transfer", kind: "转账" }),
    ];
    expect(
      unassignedAssetRecords({ ...ledger, records }).map((item) => item.id),
    ).toEqual(["unassigned"]);
  });
});
