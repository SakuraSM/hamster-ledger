// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  pendingMatchCandidates,
  recordGroupIds,
  resolvePendingRecord,
  saveEntry,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { usePendingReview } from "../packages/ledger-react/src/usePendingReview";

function fixture(): Ledger {
  const base = saveEntry(EMPTY_LEDGER, {
    id: "parent",
    date: "2026-10-05 12:00:00",
    merchant: "原账单",
    amount: 10000,
    kind: "支出",
    category: "餐饮",
    description: "",
    tags: [],
    accountId: null,
    transferToAccountId: null,
  });
  const parent = base.records[0];
  return {
    ...base,
    records: [
      parent,
      { ...parent, id: "pending", status: "pending", duplicateOf: "parent" },
      { ...parent, id: "child", status: "duplicate", duplicateOf: "pending" },
    ],
  };
}
function controller(ledger: Ledger): LedgerController {
  return {
    books: DEFAULT_BOOKS,
    ledger,
    personalLedger: ledger,
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: vi.fn(),
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
describe("pending records with existing duplicate links", () => {
  it("rejects confirming an ambiguous group without changing its parent, child or source records", () => {
    const ledger = fixture();
    const before = JSON.stringify(ledger);
    expect([...recordGroupIds(ledger.records, "pending")].sort()).toEqual([
      "child",
      "parent",
      "pending",
    ]);
    expect(() =>
      resolvePendingRecord(ledger, {
        record: ledger.records[1],
        decision: "confirm",
      }),
    ).toThrow(/重复关联|核对关联/);
    expect(JSON.stringify(ledger)).toBe(before);
  });
  it("shows a failure through the real pending-review controller without committing", async () => {
    const ledger = fixture();
    const current = controller(ledger);
    const hook = renderHook(() => usePendingReview(current));
    await act(async () => hook.result.current.resolve("confirm"));
    expect(hook.result.current.error).toMatch(/重复关联|核对关联/);
    expect(current.commit).not.toHaveBeenCalled();
    expect(ledger.records[1]).toMatchObject({
      status: "pending",
      duplicateOf: "parent",
    });
  });
  it("does not silently move an existing child group to a different candidate", () => {
    const ledger = fixture();
    ledger.records[0] = {
      ...ledger.records[0],
      source: "支付宝",
      account: "现金",
    };
    ledger.records[1] = {
      ...ledger.records[1],
      source: "招商银行",
      account: "现金",
    };
    const candidate = { ...ledger.records[0], id: "other-parent" };
    ledger.records.push(candidate);
    const record = ledger.records[1];
    expect(
      pendingMatchCandidates(ledger, record).map((item) => item.id),
    ).toContain(candidate.id);
    const before = JSON.stringify(ledger);
    expect(() =>
      resolvePendingRecord(ledger, { record, candidate, decision: "link" }),
    ).toThrow(/重复关联|核对关联/);
    expect(JSON.stringify(ledger)).toBe(before);
    expect([...recordGroupIds(ledger.records, "pending")].sort()).toEqual([
      "child",
      "parent",
      "pending",
    ]);
  });
});
