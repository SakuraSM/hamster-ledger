// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { useAdvancedEntry } from "../packages/ledger-react/src/useAdvancedEntry";
import type { NetworkClient } from "../packages/ledger-react/src/network-model";

const account: AssetAccount = {
  id: "bank",
  name: "银行卡",
  kind: "asset",
  type: "银行卡",
  currency: "CNY",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  checkpoints: [],
  isArchived: false,
};
const card: AssetAccount = {
  ...account,
  id: "card",
  name: "信用卡",
  kind: "liability",
  type: "信用卡",
};
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  accounts: [account, card],
  records: [],
};
afterEach(cleanup);

function setup(
  onSave: (ledger: Ledger) => Promise<void>,
  client: NetworkClient = {
    request: async () => {
      throw new Error("无网络请求");
    },
  },
) {
  return renderHook(() =>
    useAdvancedEntry({
      ledger,
      initialDraft: {
        type: "transfer",
        merchant: "信用卡还款",
        accountId: "",
        destinationId: card.id,
        amount: "50",
      },
      now: "2026-11-06 12:00:00",
      newId: () => "repayment",
      client,
      onSave,
      onClose: vi.fn(),
    }),
  );
}

it("clears an outdated validation error on a real edit while preserving the draft", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const { result } = setup(onSave);
  await act(() => result.current.save());
  expect(result.current.error).toBe("请先添加并选择收付款账户。");
  act(() => result.current.change("accountId", ""));
  expect(result.current.error).toBe("请先添加并选择收付款账户。");
  act(() => result.current.change("accountId", account.id));
  expect(result.current.error).toBe("");
  expect(result.current.draft.amount).toBe("50");
  expect(result.current.draft.destinationId).toBe(card.id);
  await act(() => result.current.save());
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSave.mock.calls[0][0].records[0].accountId).toBe(account.id);
});

it("retains an asynchronous save failure even when the user edits while it is in flight", async () => {
  let rejectSave: (error: Error) => void = () => {
    throw new Error("save not started");
  };
  const onSave = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  const { result } = setup(onSave);
  act(() => result.current.change("accountId", account.id));
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.save();
  });
  expect(result.current.isBusy).toBe(true);
  act(() => result.current.change("amount", "60"));
  await act(async () => {
    rejectSave(new Error("网络同步失败"));
    await pending;
  });
  expect(result.current.error).toBe("网络同步失败");
  expect(result.current.draft.amount).toBe("60");
  act(() => result.current.change("amount", "65"));
  expect(result.current.error).toBe("网络同步失败");
});

it("retains a failed exchange-rate request when the draft changes during the request", async () => {
  let rejectRequest: (error: Error) => void = () => {
    throw new Error("request not started");
  };
  const request = vi.fn().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  const { result } = setup(vi.fn(), { request });
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = result.current.fetchRate();
  });
  act(() => result.current.change("amount", "60"));
  await act(async () => {
    rejectRequest(new Error("汇率服务不可用"));
    await pending;
  });
  expect(result.current.error).toBe("汇率服务不可用");
  expect(result.current.draft.amount).toBe("60");
  act(() => result.current.change("amount", "65"));
  expect(result.current.error).toBe("汇率服务不可用");
});

it("keeps a record conflict visible after editing because the stale baseline still requires reopening", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const initial = setup(onSave);
  act(() => initial.result.current.change("accountId", account.id));
  await act(() => initial.result.current.save());
  const saved: Ledger = onSave.mock.calls[0][0];
  const baseline = saved.records[0];
  const current = { ...baseline, description: "其他设备已修改" };
  const conflict = renderHook(() =>
    useAdvancedEntry({
      ledger: { ...saved, records: [current] },
      record: baseline,
      now: "2026-11-06 12:00:00",
      newId: () => "unused",
      client: {
        request: async () => {
          throw new Error("无网络请求");
        },
      },
      onSave: vi.fn(),
      onClose: vi.fn(),
    }),
  );
  await act(() => conflict.result.current.save());
  expect(conflict.result.current.error).toContain("已发生变化");
  act(() => conflict.result.current.change("amount", "60"));
  expect(conflict.result.current.error).toContain("已发生变化");
});
