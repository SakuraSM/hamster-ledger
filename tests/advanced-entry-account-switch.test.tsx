// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  projectAccountBalance,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { useAdvancedEntry } from "../packages/ledger-react/src/useAdvancedEntry";
import type { EntryDraft } from "../packages/ledger-react/src/advanced-entry-form";
import type { NetworkClient } from "../packages/ledger-react/src/network-model";

const NOW = "2026-11-06 12:00:00";
const THROUGH = "2026-11-30 23:59:59";
const OPENING_BALANCE = 100000;
function account(id: string, currency: "CNY" | "USD" | "EUR"): AssetAccount {
  return {
    id,
    name: id,
    kind: "asset",
    type: "银行卡",
    currency,
    openingBalance: OPENING_BALANCE,
    balanceAt: "2026-01-01 00:00:00",
    aliases: [],
    checkpoints: [],
    isArchived: false,
  };
}
const accounts = [
  account("cny-source", "CNY"),
  account("cny-target", "CNY"),
  account("usd-source", "USD"),
  account("usd-target", "USD"),
  account("eur-target", "EUR"),
];
const ledger: Ledger = { ...EMPTY_LEDGER, accounts, records: [] };
const client: NetworkClient = {
  request: async () => {
    throw new Error("无需网络请求");
  },
};
function setup(
  initialDraft: Partial<EntryDraft>,
  networkClient: NetworkClient = client,
) {
  const onSave = vi
    .fn<(next: Ledger, date: string) => Promise<void>>()
    .mockResolvedValue(undefined);
  const onClose = vi.fn();
  const hook = renderHook(() =>
    useAdvancedEntry({
      ledger,
      initialDraft: {
        type: "transfer",
        merchant: "账户转账",
        category: "转账",
        amount: "10",
        ...initialDraft,
      },
      now: NOW,
      newId: () => "transfer-test",
      client: networkClient,
      onSave,
      onClose,
    }),
  );
  return { ...hook, onSave, onClose };
}
function projectedBalance(ledger: Ledger, id: string): number {
  const target = ledger.accounts.find((item) => item.id === id);
  if (!target) throw new Error(`账户不存在: ${id}`);
  return projectAccountBalance({ ledger, account: target, through: THROUGH })
    .balance;
}
afterEach(cleanup);

describe("advanced entry account changes", () => {
  it("clears a cross-currency received amount when changing the source makes it same-currency", async () => {
    const { result, onSave } = setup({
      accountId: "usd-source",
      destinationId: "cny-target",
      rate: "7",
      destinationAmount: "80",
      destinationRate: "7.1",
    });
    act(() => result.current.change("accountId", "cny-source"));
    expect(result.current.draft.destinationAmount).toBe("");
    expect(result.current.draft.destinationRate).toBe("");
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(saved.records[0].detail?.destination?.minor).toBe(1000);
    expect(projectedBalance(saved, "cny-source")).toBe(99000);
    expect(projectedBalance(saved, "cny-target")).toBe(101000);
    expect(projectedBalance(saved, "usd-source")).toBe(OPENING_BALANCE);
  });
  it("requires fresh received amount and rate when switching to another foreign destination", async () => {
    const { result, onSave } = setup({
      accountId: "cny-source",
      destinationId: "usd-target",
      rate: "1",
      destinationAmount: "12",
      destinationRate: "7.1",
    });
    act(() => result.current.change("destinationId", "eur-target"));
    expect(result.current.draft.destinationAmount).toBe("");
    expect(result.current.draft.destinationRate).toBe("");
    await act(() => result.current.save());
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.error).not.toBe("");
    act(() => {
      result.current.change("destinationAmount", "2.5");
      result.current.change("destinationRate", "7.5");
    });
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(projectedBalance(saved, "cny-source")).toBe(99000);
    expect(projectedBalance(saved, "eur-target")).toBe(100250);
    expect(projectedBalance(saved, "usd-target")).toBe(OPENING_BALANCE);
  });
  it("retains destination fields on repeated selections, date changes and other edits", async () => {
    const { result, onSave } = setup({
      accountId: "usd-source",
      destinationId: "eur-target",
      rate: "7.2",
      destinationAmount: "12.5",
      destinationRate: "8.3",
    });
    act(() => {
      result.current.change("accountId", "usd-source");
      result.current.change("destinationId", "eur-target");
    });
    expect(result.current.draft.rate).toBe("7.2");
    expect(result.current.draft.destinationAmount).toBe("12.5");
    expect(result.current.draft.destinationRate).toBe("8.3");
    act(() => {
      result.current.change("date", "2026-11-07 12:00:00");
      result.current.change("merchant", "手动转账");
      result.current.change("rate", "7.3");
    });
    expect(result.current.draft.destinationAmount).toBe("12.5");
    expect(result.current.draft.destinationRate).toBe("8.3");
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(projectedBalance(saved, "usd-source")).toBe(99000);
    expect(projectedBalance(saved, "eur-target")).toBe(101250);
  });
  it("keeps a cached rate confirmation when the same source is selected again", async () => {
    const request = vi.fn().mockResolvedValue({
      currency: "USD",
      date: "2026-11-06",
      rate: "7.2",
      source: "frankfurter",
      isCached: true,
      needsConfirmation: true,
    });
    const { result } = setup(
      {
        accountId: "usd-source",
        destinationId: "eur-target",
        destinationAmount: "12.5",
        destinationRate: "8.3",
      },
      { request },
    );
    await act(() => result.current.fetchRate());
    expect(result.current.needsRateConfirmation).toBe(true);
    expect(result.current.quote?.rate).toBe("7.2");
    act(() => result.current.change("accountId", "usd-source"));
    expect(result.current.needsRateConfirmation).toBe(true);
    expect(result.current.quote?.rate).toBe("7.2");
    expect(result.current.draft.destinationAmount).toBe("12.5");
    expect(result.current.draft.destinationRate).toBe("8.3");
  });
  it("preserves an explicitly entered same-currency received amount", async () => {
    const { result, onSave } = setup({
      accountId: "cny-source",
      destinationId: "cny-target",
      rate: "1",
      destinationAmount: "9.85",
    });
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(saved.records[0].detail?.destination?.minor).toBe(985);
    expect(projectedBalance(saved, "cny-source")).toBe(99000);
    expect(projectedBalance(saved, "cny-target")).toBe(100985);
  });
});
