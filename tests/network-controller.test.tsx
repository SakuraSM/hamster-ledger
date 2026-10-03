// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  migrateLedger,
} from "@hamster-ledger/core";
import {
  useNetworkLedger,
  type LedgerController,
  type NetworkClient,
  type NetworkSnapshot,
} from "@hamster-ledger/ledger-react";

afterEach(cleanup);
function fixture() {
  const cache = migrateLedger({ ...EMPTY_LEDGER, rules: { 虚拟店: "餐饮" } });
  const repository = createLedgerRepository({
    getItem: async () => null,
    setItem: async () => {},
  });
  const local: LedgerController = {
    books: DEFAULT_BOOKS.map((book) =>
      book.id === "personal"
        ? {
            ...book,
            cloud: {
              id: "remote",
              userId: "user",
              server: "https://test",
              role: "owner",
            },
          }
        : book,
    ),
    ledger: cache,
    personalLedger: cache,
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
    notify: () => {},
  };
  const snapshot: NetworkSnapshot = {
    id: "remote",
    name: "虚拟账本",
    role: "owner",
    revision: 1,
    updatedAt: "2026-10-03",
    ledger: cache,
  };
  const request = vi
    .fn<() => Promise<NetworkSnapshot>>()
    .mockResolvedValue(snapshot);
  const client: NetworkClient = {
    request: async <T,>() => (await request()) as T,
  };
  return { local, repository, snapshot, request, client, cache };
}
it("keeps the offline cache read-only and recovers after reconnecting", async () => {
  const env = fixture();
  env.request.mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(() =>
    useNetworkLedger({
      ...env,
      userId: "user",
      server: "https://test",
      newId: () => "request-key",
    }),
  );
  await waitFor(() => expect(result.current.network?.error).toBe("offline"));
  expect(result.current.ledger).toEqual(env.cache);
  await expect(result.current.commit(env.cache)).rejects.toThrow("当前只读");
  expect(env.local.commit).not.toHaveBeenCalled();
  await act(async () => result.current.network?.refresh());
  expect(result.current.network?.isOnline).toBe(true);
});
it("hides protected cached data after membership revocation and across account changes", async () => {
  const env = fixture();
  const { result, rerender } = renderHook(
    ({ userId }) =>
      useNetworkLedger({
        ...env,
        userId,
        server: "https://test",
        newId: () => "request-key",
      }),
    { initialProps: { userId: "user" } },
  );
  await waitFor(() => expect(result.current.network?.isOnline).toBe(true));
  env.request.mockRejectedValueOnce(
    Object.assign(new Error("removed"), { status: 404 }),
  );
  await act(async () => result.current.network?.refresh());
  expect(result.current.ledger.rules).toEqual({});
  await expect(result.current.commit(env.cache)).rejects.toThrow("当前只读");
  rerender({ userId: "other-user" });
  expect(result.current.ledger.rules).toEqual({});
});
it("preserves the form's proposed value on conflict and retains undo on an unchanged refresh", async () => {
  const env = fixture();
  env.snapshot.operationId = "op-one";
  const { result } = renderHook(() =>
    useNetworkLedger({
      ...env,
      userId: "user",
      server: "https://test",
      newId: () => "request-key",
    }),
  );
  await waitFor(() => expect(result.current.canUndo).toBe(true));
  env.request.mockResolvedValueOnce({
    ...env.snapshot,
    operationId: undefined,
  });
  await act(async () => result.current.network?.refresh());
  expect(result.current.canUndo).toBe(true);
  const proposal = { ...env.cache, rules: { 虚拟店: "购物" } };
  env.request.mockRejectedValueOnce(
    Object.assign(new Error("revision conflict"), { status: 409 }),
  );
  await act(async () => {
    await expect(result.current.commit(proposal)).rejects.toThrow(
      "revision conflict",
    );
  });
  expect(proposal.rules).toEqual({ 虚拟店: "购物" });
  expect(result.current.ledger.rules).toEqual(env.cache.rules);
});
