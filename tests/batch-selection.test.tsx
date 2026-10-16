// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_BOOKS } from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import {
  useBatchRecords,
  type LedgerController,
} from "@hamster-ledger/ledger-react";

afterEach(cleanup);
function fixture(): LedgerController {
  const ledger = createDemoLedger();
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

it("discloses hidden selections and only discards them when requested", () => {
  const controller = fixture();
  const [first, second] = controller.ledger.records;
  const { result, rerender } = renderHook(
    ({ visible }) => useBatchRecords(controller, visible),
    { initialProps: { visible: [first, second] } },
  );
  act(() => result.current.select([first, second]));
  rerender({ visible: [first] });
  expect(result.current.selected).toEqual([first.id, second.id]);
  expect(result.current.hiddenCount).toBe(1);
  act(() => result.current.retainVisible());
  expect(result.current.selected).toEqual([first.id]);
  expect(result.current.hiddenCount).toBe(0);
  rerender({ visible: [] });
  expect(result.current.hiddenCount).toBe(1);
  act(() => result.current.clear());
  expect(result.current.hiddenCount).toBe(0);
});

it("retains the selection snapshot so changed records still block a bulk write", async () => {
  const controller = fixture();
  const first = controller.ledger.records[0];
  const { result, rerender } = renderHook(
    ({ current, visible }) => useBatchRecords(current, visible),
    { initialProps: { current: controller, visible: [first] } },
  );
  act(() => result.current.toggle(first));
  const changed = { ...first, description: "changed after selection" };
  const current = {
    ...controller,
    ledger: {
      ...controller.ledger,
      records: controller.ledger.records.map((item) =>
        item.id === first.id ? changed : item,
      ),
    },
  };
  rerender({ current, visible: [changed] });
  act(() => result.current.retainVisible());
  await act(async () => result.current.apply("delete"));
  expect(result.current.error).toContain("发生变化");
  expect(controller.commit).not.toHaveBeenCalled();
  expect(result.current.selected).toEqual([first.id]);
});
