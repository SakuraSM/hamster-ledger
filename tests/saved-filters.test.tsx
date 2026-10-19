// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSavedFilters } from "@hamster-ledger/ledger-react";
import {
  STORAGE_PREFIX,
  savedFiltersSchema,
  type KeyValueStore,
  type TransactionFilter,
} from "@hamster-ledger/core";
afterEach(cleanup);
function fixture() {
  const values = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  return { values, store };
}
it("saves a named filter and restores the last page after reopening", async () => {
  const { store, values } = fixture();
  const onApply = vi.fn();
  const props = {
    store,
    bookId: "a",
    filter: { reimbursement: "pending" } as TransactionFilter,
    position: 4,
    onApply,
  };
  const first = renderHook(() => useSavedFilters(props));
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  await act(async () => first.result.current.save("待报销"));
  expect(first.result.current.presets[0].filter.reimbursement).toBe("pending");
  first.unmount();
  await waitFor(() => expect(values.size).toBe(1));
  const next = renderHook(() =>
    useSavedFilters({ ...props, filter: {}, position: 0 }),
  );
  await waitFor(() => expect(next.result.current.ready).toBe(true));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      position: 4,
      filter: expect.objectContaining({ reimbursement: "pending" }),
    }),
  );
});
it("does not write the next book's filter into the previous book", async () => {
  const { store, values } = fixture();
  const hook = renderHook(
    ({ bookId, query }) =>
      useSavedFilters({
        store,
        bookId,
        filter: { query },
        position: 0,
        onApply: vi.fn(),
      }),
    { initialProps: { bookId: "a", query: "甲" } },
  );
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(async () => hook.result.current.save("甲的方案"));
  hook.rerender({ bookId: "b", query: "乙" });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await act(async () => hook.result.current.save("乙的方案"));
  expect(
    savedFiltersSchema.parse(
      JSON.parse(values.get(`${STORAGE_PREFIX}saved-filters.v1:a`)!),
    ).last?.filter.query,
  ).toBe("甲");
  expect(hook.result.current.presets.map((item) => item.name)).toEqual([
    "乙的方案",
  ]);
});
it("keeps malformed saved data intact and reports storage write failure", async () => {
  const { store, values } = fixture();
  values.set(`${STORAGE_PREFIX}saved-filters.v1:a`, "broken");
  const corrupt = renderHook(() =>
    useSavedFilters({
      store,
      bookId: "a",
      filter: {},
      position: 0,
      onApply: vi.fn(),
    }),
  );
  await waitFor(() =>
    expect(corrupt.result.current.error).toContain("无法读取"),
  );
  await act(async () => corrupt.result.current.save("不能覆盖"));
  expect(values.get(`${STORAGE_PREFIX}saved-filters.v1:a`)).toBe("broken");
  corrupt.unmount();
  const failingStore: KeyValueStore = {
    ...store,
    setItem: async () => {
      throw new Error("quota");
    },
  };
  const failing = renderHook(() =>
    useSavedFilters({
      store: failingStore,
      bookId: "b",
      filter: {},
      position: 0,
      onApply: vi.fn(),
    }),
  );
  await waitFor(() => expect(failing.result.current.ready).toBe(true));
  await act(async () => failing.result.current.save("失败的方案"));
  expect(failing.result.current.presets).toEqual([]);
  expect(failing.result.current.error).toContain("保存失败");
});
it("captures the selected filter before a queued save and a book switch", async () => {
  const values = new Map<string, string>();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  const store: KeyValueStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (++writes === 1) await gate;
      values.set(key, value);
    },
  };
  const hook = renderHook(
    ({ bookId, query }) =>
      useSavedFilters({
        store,
        bookId,
        filter: { query },
        position: 0,
        onApply: vi.fn(),
      }),
    { initialProps: { bookId: "a", query: "甲" } },
  );
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  let saving!: Promise<void>;
  act(() => {
    saving = hook.result.current.save("甲方案");
  });
  hook.rerender({ bookId: "b", query: "乙" });
  await act(async () => {
    release();
    await saving;
  });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  const first = savedFiltersSchema.parse(
    JSON.parse(values.get(`${STORAGE_PREFIX}saved-filters.v1:a`)!),
  );
  expect(first.presets[0].filter.query).toBe("甲");
  expect(hook.result.current.presets).toEqual([]);
});
