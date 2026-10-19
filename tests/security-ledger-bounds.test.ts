import { expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  applyLedgerPatch,
  saveEntry,
  summarize,
  type AssetAccount,
} from "@hamster-ledger/core";

const record = saveEntry(EMPTY_LEDGER, {
  id: "synthetic-entry",
  date: "2026-10-19 12:00:00",
  merchant: "合成测试",
  amount: 1,
  kind: "支出",
  category: "餐饮",
  description: "",
  tags: [],
  accountId: null,
  transferToAccountId: null,
}).records[0];

it("rejects individually safe member amounts whose selected total overflows", () => {
  expect(() =>
    applyLedgerPatch({
      ledger: EMPTY_LEDGER,
      actor: { userId: "member", role: "member" },
      patch: {
        changes: [Number.MAX_SAFE_INTEGER, 1].map((amount, index) => ({
          collection: "records" as const,
          id: `record-${index}`,
          value: { ...record, id: `record-${index}`, amount },
        })),
      },
    }),
  ).toThrow(/累计金额/);
});

it("preserves ordinary member batches and server-assigned ownership", () => {
  const ledger = applyLedgerPatch({
    ledger: EMPTY_LEDGER,
    actor: { userId: "member", role: "member" },
    patch: {
      changes: [1250, 600].map((amount, index) => ({
        collection: "records" as const,
        id: `record-${index}`,
        value: { ...record, id: `record-${index}`, amount },
      })),
    },
  });
  expect(summarize(ledger.records).expense).toBe(1850);
  expect(
    ledger.records.every((item) => item.detail?.memberId === "member"),
  ).toBe(true);
});

it("processes large no-op deletion batches without repeated full-ledger work", () => {
  const ledger = {
    ...EMPTY_LEDGER,
    records: Array.from({ length: 5000 }, (_, index) => ({
      ...record,
      id: `record-${index}`,
    })),
  };
  const started = performance.now();
  const result = applyLedgerPatch({
    ledger,
    actor: { userId: "owner", role: "owner" },
    patch: {
      changes: Array.from({ length: 2000 }, (_, index) => ({
        collection: "reviews" as const,
        id: `missing-${index}`,
        value: null,
      })),
    },
  });
  expect(result.records).toHaveLength(5000);
  expect(performance.now() - started).toBeLessThan(2000);
});

it("rejects aggregate overflow from member transfers between existing accounts", () => {
  const accounts: AssetAccount[] = ["a", "b"].map((id) => ({
    id,
    name: id,
    kind: "asset",
    type: "银行卡",
    openingBalance: 0,
    balanceAt: "2026-01-01 00:00:00",
    aliases: [],
    checkpoints: [],
    isArchived: false,
  }));
  expect(() =>
    applyLedgerPatch({
      ledger: { ...EMPTY_LEDGER, accounts },
      actor: { userId: "member", role: "member" },
      patch: {
        changes: [Number.MAX_SAFE_INTEGER, 1].map((amount, index) => ({
          collection: "records" as const,
          id: `transfer-${index}`,
          value: {
            ...record,
            id: `transfer-${index}`,
            amount,
            kind: "转账",
            accountId: "a",
            transferToAccountId: "b",
            detail: undefined,
          },
        })),
      },
    }),
  ).toThrow(/累计金额/);
});
