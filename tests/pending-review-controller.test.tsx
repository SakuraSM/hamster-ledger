// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  planImport,
  type Ledger,
} from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import {
  usePendingReview,
  type LedgerController,
} from "@hamster-ledger/ledger-react";

afterEach(cleanup);
function fixture(): LedgerController {
  const record = {
    ...createDemoLedger().records[0],
    source: "支付宝" as const,
    status: "confirmed" as const,
    account: "虚拟银行卡",
    linkedSources: [],
  };
  const ledger = planImport(EMPTY_LEDGER, [
    { ...record, id: "first", orderId: "first" },
    { ...record, id: "second", orderId: "second" },
    { ...record, id: "bank", orderId: "bank", source: "招商银行" },
  ]).ledger;
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
    switchMode: () => {},
    commit: vi.fn(),
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: vi.fn(),
  };
}

it("requires a deliberate candidate and preserves the selection after a failed save", async () => {
  const controller = fixture();
  controller.commit = vi
    .fn()
    .mockRejectedValueOnce(new Error("存储不可用"))
    .mockResolvedValueOnce(undefined);
  const { result, rerender } = renderHook(usePendingReview, {
    initialProps: controller,
  });
  expect(result.current.candidate).toBeUndefined();
  await act(async () => result.current.resolve("link"));
  expect(result.current.error).toContain("先选择");
  expect(controller.commit).not.toHaveBeenCalled();
  act(() => result.current.selectCandidate("second"));
  await act(async () => result.current.resolve("link"));
  expect(result.current.error).toBe("存储不可用");
  expect(result.current.candidate?.id).toBe("second");
  expect(result.current.record?.status).toBe("pending");
  expect(controller.notify).not.toHaveBeenCalled();
  await act(async () => result.current.resolve("link"));
  const saved = vi.mocked(controller.commit).mock.calls[1][0];
  rerender({ ...controller, ledger: saved });
  expect(result.current.record).toBeUndefined();
  expect(controller.notify).toHaveBeenCalledOnce();
});

it("submits only one decision while a save is pending", async () => {
  const controller = fixture();
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  controller.commit = vi.fn<LedgerController["commit"]>(() => pending);
  const { result } = renderHook(() => usePendingReview(controller));
  await act(async () => {
    const first = result.current.resolve("confirm");
    const second = result.current.resolve("confirm");
    expect(controller.commit).toHaveBeenCalledOnce();
    complete();
    await Promise.all([first, second]);
  });
  const saved: Ledger = vi.mocked(controller.commit).mock.calls[0][0];
  expect(saved.records.find((item) => item.id === "bank")?.status).toBe(
    "confirmed",
  );
});
