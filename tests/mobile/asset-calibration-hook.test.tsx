// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { useBalanceCalibration } from "../../packages/ledger-react/src/useBalanceCalibration";

afterEach(cleanup);
it("starts empty when the selected time has no balance baseline", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "account",
    balanceAt: "2026-11-10 00:00:00",
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useBalanceCalibration({
      ledger: { ...example, accounts: [account], records: [] },
      account,
      initialAt: "2026-11-06 12:00:00",
      now: () => "2026-11-06 12:00:00",
      onSave,
      onClose: vi.fn(),
    }),
  );
  expect(result.current.amount).toBe("");
  expect(result.current.preview).toBeNull();
  act(() => result.current.setAmount("0"));
  expect(result.current.preview).toEqual({
    expected: null,
    actual: 0,
    difference: null,
  });
  await act(() => result.current.save());
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSave.mock.calls[0][0].expectedAccount).toEqual(account);
});
it("passes a detached opening snapshot even if the account changes while the draft is open", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "account",
    aliases: ["旧别名"],
    checkpoints: [],
  };
  const original = {
    ...account,
    aliases: [...account.aliases],
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const { result, rerender } = renderHook(
    ({ ledger }) =>
      useBalanceCalibration({
        ledger,
        account,
        initialAt: "2026-11-06 12:00:00",
        now: () => "2026-11-06 12:00:00",
        onSave,
        onClose: vi.fn(),
      }),
    {
      initialProps: {
        ledger: { ...example, accounts: [account], records: [] },
      },
    },
  );
  act(() => result.current.setAmount("123.45"));
  account.aliases.push("新别名");
  rerender({ ledger: { ...example, accounts: [account], records: [] } });
  await act(() => result.current.save());
  expect(onSave).toHaveBeenCalledOnce();
  expect(onSave.mock.calls[0][0].expectedAccount).toEqual(original);
  expect(onSave.mock.calls[0][0].account.aliases).toEqual(["旧别名", "新别名"]);
});

it("runs only one save when confirmation is pressed twice before rendering", async () => {
  const example = createDemoLedger();
  const account = { ...example.accounts[0], id: "account", checkpoints: [] };
  let release = (): void => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const onSave = vi.fn(() => pending);
  const { result } = renderHook(() =>
    useBalanceCalibration({
      ledger: { ...example, accounts: [account], records: [] },
      account,
      initialAt: "2026-11-06 12:00:00",
      now: () => "2026-11-06 12:00:00",
      onSave,
      onClose: vi.fn(),
    }),
  );
  let first: Promise<void>;
  let second: Promise<void>;
  act(() => {
    first = result.current.save();
    second = result.current.save();
  });
  expect(onSave).toHaveBeenCalledOnce();
  release();
  await act(async () => {
    await Promise.all([first, second]);
  });
});
