// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  createLedgerRepository,
  type Ledger,
  type LedgerMode,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";

afterEach(cleanup);
function fixture() {
  const books = ["a", "b"].map((id) => ({
    id: `book:${id}` as LedgerMode,
    name: id,
    cloud: { id, userId: "u", server: "https://test", role: "owner" as const },
  }));
  const snapshots = new Map<string, NetworkSnapshot>(
    books.map(({ cloud }) => [
      cloud.id,
      {
        id: cloud.id,
        name: cloud.id,
        revision: 1,
        updatedAt: "2026-01-01",
        role: "owner",
        ledger: {
          ...EMPTY_LEDGER,
          accounts: [
            {
              id: cloud.id,
              name: cloud.id,
              kind: "asset",
              type: "现金",
              openingBalance: 100,
              balanceAt: "2026-01-01 00:00:00",
              aliases: [],
              isArchived: false,
              checkpoints: [],
            },
          ],
        },
      },
    ]),
  );
  const posts: Array<{ id: string; revision: number; undoId?: string }> = [];
  let sequence = 0;
  let isOffline = false;
  let cacheFailure = false;
  const client: NetworkClient = {
    request: async <Result,>(
      path: string,
      options?: { method?: string; body?: unknown },
    ) => {
      const id = path.split("/")[3];
      const snapshot = snapshots.get(id);
      if (!snapshot) throw new Error("账本不存在");
      if (!options?.method) {
        if (isOffline) throw new Error("offline");
        return JSON.parse(JSON.stringify(snapshot)) as Result;
      }
      const body = options.body as { revision: number; undoId?: string };
      posts.push({ id, revision: body.revision, undoId: body.undoId });
      if (body.revision !== snapshot.revision)
        throw new Error("revision conflict");
      const updated = { ...snapshot, revision: snapshot.revision + 1 };
      snapshots.set(id, updated);
      return { ...updated, operationId: `op-${id}-${++sequence}` } as Result;
    },
  };
  const local: LedgerController = {
    books,
    ledger: EMPTY_LEDGER,
    personalLedger: EMPTY_LEDGER,
    mode: "book:a",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: () => {},
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
  const values = new Map<string, string>();
  const repository = createLedgerRepository({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (cacheFailure && key.includes("network-cache"))
        throw new Error("本机存储不可写");
      values.set(key, value);
    },
  });
  return {
    local,
    client,
    repository,
    posts,
    setOffline: (value: boolean) => {
      isOffline = value;
    },
    failCacheWrites: (value: boolean) => {
      cacheFailure = value;
    },
    setRole: (id: string, role: NetworkSnapshot["role"]) => {
      const current = snapshots.get(id);
      if (!current) throw new Error("账本不存在");
      snapshots.set(id, { ...current, role });
    },
  };
}
function setup(env: ReturnType<typeof fixture>) {
  return renderHook(
    ({ local }) =>
      useNetworkLedger({
        local,
        client: env.client,
        userId: "u",
        server: "https://test",
        repository: env.repository,
        newId: () => "test-operation",
      }),
    { initialProps: { local: env.local } },
  );
}
async function ready(
  hook: ReturnType<typeof setup>,
  accountId: string,
): Promise<void> {
  await waitFor(() => {
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.ledger.accounts[0]?.id).toBe(accountId);
  });
}
async function save(hook: ReturnType<typeof setup>): Promise<void> {
  await act(async () =>
    hook.result.current.commit(hook.result.current.ledger as Ledger),
  );
}

describe("network undo context and revision", () => {
  it("keeps a server-confirmed undo and reports only the offline cache failure", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    env.failCacheWrites(true);
    act(() => hook.result.current.undo());
    await waitFor(() => expect(env.posts).toHaveLength(2));
    await waitFor(() => expect(hook.result.current.network?.revision).toBe(3));
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.error).toMatch(
      /服务器已保存.*离线缓存/,
    );
    expect(env.local.notify).toHaveBeenCalledWith("已撤销，操作历史已保留。");
  });
  it("does not let an old book A undo callback undo the latest operation in book B", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const undoA = hook.result.current.undo;
    hook.rerender({ local: { ...env.local, mode: "book:b" } });
    await ready(hook, "b");
    await save(hook);
    const before = env.posts.length;
    await act(async () => {
      undoA();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
    act(() => hook.result.current.undo());
    await waitFor(() => expect(env.posts).toHaveLength(before + 1));
    expect(env.posts.at(-1)).toMatchObject({ id: "b", undoId: "op-b-2" });
  });
  it("does not undo a later operation in the same book through an older callback", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    await save(hook);
    const before = env.posts.length;
    await act(async () => {
      oldUndo();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
    act(() => hook.result.current.undo());
    await waitFor(() => expect(env.posts).toHaveLength(before + 1));
    expect(env.posts.at(-1)).toMatchObject({ id: "a", undoId: "op-a-2" });
  });
  it("keeps stale undo read-only offline and allows a new undo after reconnect", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    env.setOffline(true);
    await act(async () => hook.result.current.network?.refresh());
    const before = env.posts.length;
    await act(async () => {
      oldUndo();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
    env.setOffline(false);
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.network?.isOnline).toBe(true);
    act(() => hook.result.current.undo());
    await waitFor(() => expect(env.posts).toHaveLength(before + 1));
    expect(env.posts.at(-1)?.undoId).toBe("op-a-1");
  });
  it("rejects an old callback after leaving and reopening the same book", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    hook.rerender({ local: { ...env.local, mode: "book:b" } });
    await ready(hook, "b");
    hook.rerender({ local: env.local });
    await ready(hook, "a");
    await save(hook);
    const before = env.posts.length;
    await act(async () => {
      oldUndo();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
  });
  it("accepts the same-revision refresh before undoing the same operation", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    await act(async () => hook.result.current.network?.refresh());
    const before = env.posts.length;
    act(() => oldUndo());
    await waitFor(() => expect(env.posts).toHaveLength(before + 1));
    expect(env.posts.at(-1)?.undoId).toBe("op-a-1");
  });
  it("does not undo after a same-revision read-only role change", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    env.setRole("a", "viewer");
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.canUndo).toBe(false);
    const before = env.posts.length;
    await act(async () => {
      oldUndo();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
  });
  it("does not use an older operation ID after a same-revision replacement", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, "a");
    await save(hook);
    const oldUndo = hook.result.current.undo;
    await act(async () =>
      hook.result.current.network?.receive?.({
        id: "a",
        name: "a",
        revision: 2,
        updatedAt: "2026-01-01",
        role: "owner",
        ledger: hook.result.current.ledger,
        operationId: "replacement",
      }),
    );
    const before = env.posts.length;
    await act(async () => {
      oldUndo();
      await Promise.resolve();
    });
    expect(env.posts).toHaveLength(before);
    act(() => hook.result.current.undo());
    await waitFor(() => expect(env.posts).toHaveLength(before + 1));
    expect(env.posts.at(-1)?.undoId).toBe("replacement");
  });
});
