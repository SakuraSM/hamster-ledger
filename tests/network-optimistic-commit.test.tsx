// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  applyLedgerPatch,
  archiveAssetAccount,
  createLedgerRepository,
  type BillRecord,
  type Ledger,
  type LedgerMode,
  type LedgerPatch,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { useAiLedger } from "../packages/ledger-react/src/useAiLedger";

afterEach(cleanup);
const record: BillRecord = {
  id: "bill",
  date: "2026-02-01 12:00:00",
  merchant: "旧商户",
  description: "",
  amount: 100,
  currency: "CNY",
  kind: "支出",
  category: "其他",
  source: "手动记账",
  account: "现金",
  accountId: "cash",
  orderId: "",
  status: "confirmed",
  sourceStatus: "已确认",
  fileName: "virtual",
  raw: {},
  linkedSources: [],
};
const originalCloud = { id: "remote", userId: "user", server: "https://test" };
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  records: [record],
  accounts: [
    {
      id: "cash",
      name: "现金",
      kind: "asset",
      type: "现金",
      openingBalance: 100000,
      balanceAt: "2026-01-01 00:00:00",
      aliases: [],
      isArchived: false,
      checkpoints: [],
    },
  ],
};
type Operation = { key: string; revision: number; patch: LedgerPatch };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  let readError = false;
  let aiPosts = 0;
  let cacheFailure = false;
  let cacheReadFailure = false;
  let heldCacheWrite: ReturnType<typeof deferred> | null = null;
  let cacheWriteStarted: ReturnType<typeof deferred> | null = null;
  let snapshot: NetworkSnapshot = {
    id: "remote",
    name: "联网账",
    role: "owner",
    revision: 1,
    updatedAt: "2026-10-03",
    ledger,
  };
  const operations: Operation[] = [];
  const localCommit = vi.fn(async () => {});
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
    commit: localCommit,
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: () => {},
  };
  const values = new Map<string, string>();
  const repository = createLedgerRepository({
    getItem: async (key) => {
      if (cacheReadFailure && key.includes("network-cache"))
        throw new Error("缓存读取失败");
      return values.get(key) ?? null;
    },
    setItem: async (key, value) => {
      if (key.includes("network-cache")) {
        const hold = heldCacheWrite;
        const started = cacheWriteStarted;
        heldCacheWrite = null;
        cacheWriteStarted = null;
        if (hold && started) {
          started.resolve();
          await hold.promise;
        }
        if (cacheFailure) throw new Error("本机存储不可写");
      }
      values.set(key, value);
    },
  });
  const client: NetworkClient = {
    request: async <Result,>(
      path: string,
      options?: { method?: string; body?: unknown },
    ) => {
      if (path.endsWith("/ai/options")) return { autoPost: false } as Result;
      if (path.endsWith("/ai/recognize")) {
        aiPosts += 1;
        snapshot = { ...snapshot, revision: snapshot.revision + 1 };
        return { ...structuredClone(snapshot), drafts: [] } as Result;
      }
      if (options?.method === "POST") {
        const operation = options.body as Operation;
        operations.push(operation);
        if (operation.revision !== snapshot.revision)
          throw new Error("revision conflict");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          ledger: applyLedgerPatch({
            ledger: snapshot.ledger,
            patch: operation.patch,
            actor: { userId: "user", role: "owner" },
          }),
        };
      } else if (readError) throw new Error("offline");
      return structuredClone(snapshot) as Result;
    },
  };
  return {
    local,
    localCommit,
    repository,
    client,
    operations,
    aiPosts: () => aiPosts,
    setOffline: () => {
      readError = true;
    },
    failCacheWrites: (value: boolean) => {
      cacheFailure = value;
    },
    failCacheReads: (value: boolean) => {
      cacheReadFailure = value;
    },
    holdCacheWrite: () => {
      heldCacheWrite = deferred();
      cacheWriteStarted = deferred();
      return { hold: heldCacheWrite, started: cacheWriteStarted };
    },
    getSnapshot: () => snapshot,
    setSnapshot: (value: NetworkSnapshot) => {
      snapshot = value;
    },
  };
}
function setup(env: ReturnType<typeof fixture>) {
  return renderHook(
    ({
      local,
      userId,
      server,
    }: {
      local: LedgerController;
      userId: string | null;
      server: string;
    }) =>
      useNetworkLedger({
        local,
        userId,
        server,
        client: env.client,
        repository: env.repository,
        newId: () => "test-key",
      }),
    {
      initialProps: {
        local: env.local,
        userId: "user",
        server: "https://test",
      },
    },
  );
}
function archive(ledgerValue: Ledger): Ledger {
  return archiveAssetAccount({
    ledger: ledgerValue,
    accountId: "cash",
    isArchived: true,
    at: "2026-11-06 12:00:00",
  });
}
async function ready(hook: ReturnType<typeof setup>): Promise<void> {
  await waitFor(() => expect(hook.result.current.network?.isOnline).toBe(true));
}
async function advance(
  env: ReturnType<typeof fixture>,
  hook: ReturnType<typeof setup>,
): Promise<void> {
  const snapshot = env.getSnapshot();
  env.setSnapshot({
    ...snapshot,
    revision: 2,
    ledger: {
      ...snapshot.ledger,
      records: [{ ...record, merchant: "新商户", amount: 200 }],
    },
  });
  await act(async () => hook.result.current.network?.refresh());
  expect(hook.result.current.network?.revision).toBe(2);
}

describe("network optimistic commit", () => {
  it("finishes AI recognition when the server saved but the cache write failed", async () => {
    const env = fixture();
    const hook = renderHook(() => {
      const controller = useNetworkLedger({
        local: env.local,
        userId: "user",
        server: "https://test",
        client: env.client,
        repository: env.repository,
        newId: () => "test-key",
      });
      const ai = useAiLedger({
        controller,
        client: env.client,
        profile: { config: null, hasKey: false },
        isAuthenticated: true,
        store: {
          list: async () => [],
          get: async () => {
            throw new Error("无附件");
          },
          put: async () => {},
          remove: async () => {},
        },
        storageId: "personal",
        localNow: () => "2026-11-07 12:00:00",
        newId: () => "test-key",
        hash: async () => "synthetic-hash",
      });
      return { controller, ai };
    });
    await waitFor(() =>
      expect(hook.result.current.controller.network?.isOnline).toBe(true),
    );
    act(() => hook.result.current.ai.setText("测试文本"));
    env.failCacheWrites(true);
    await act(async () => hook.result.current.ai.recognize());
    expect(env.aiPosts()).toBe(1);
    expect(hook.result.current.ai.error).toBe("");
    expect(hook.result.current.ai.text).toBe("");
    expect(hook.result.current.controller.network?.revision).toBe(2);
    expect(hook.result.current.controller.network?.error).toMatch(
      /服务器已保存.*离线缓存/,
    );
  });
  it("publishes a successful server write when only the offline cache fails", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current;
    env.failCacheWrites(true);
    await act(async () => old.commit(archive(old.ledger)));
    expect(env.operations).toHaveLength(1);
    expect(env.getSnapshot().revision).toBe(2);
    expect(hook.result.current.network?.revision).toBe(2);
    expect(hook.result.current.ledger.accounts[0].isArchived).toBe(true);
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.error).toMatch(
      /服务器已保存.*离线缓存/,
    );
    await expect(old.commit(archive(old.ledger))).rejects.toThrow(/变化|更新/);
    expect(env.operations).toHaveLength(1);
    const next = archiveAssetAccount({
      ledger: hook.result.current.ledger,
      accountId: "cash",
      isArchived: false,
      at: "2026-11-06 13:00:00",
    });
    await act(async () => hook.result.current.commit(next));
    expect(env.operations.at(-1)?.revision).toBe(2);
    expect(hook.result.current.network?.revision).toBe(3);
    env.failCacheWrites(false);
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.network?.revision).toBe(3);
    expect(hook.result.current.network?.error).toBe("");
  });

  it("keeps a failed GET cache write distinct from a saved server operation", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    env.setSnapshot({ ...env.getSnapshot(), revision: 2 });
    env.failCacheWrites(true);
    await act(async () => hook.result.current.network?.refresh());
    expect(env.operations).toHaveLength(0);
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.network?.revision).toBe(1);
    expect(hook.result.current.network?.error).not.toMatch(/服务器已保存/);
  });

  it("fails closed when a successful server write cannot recheck cache authorization", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    env.failCacheWrites(true);
    env.failCacheReads(true);
    await act(async () => {
      await expect(
        hook.result.current.commit(archive(hook.result.current.ledger)),
      ).rejects.toThrow(/服务器已保存.*核验/);
    });
    expect(env.getSnapshot().revision).toBe(2);
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(hook.result.current.network?.error).toMatch(/服务器已保存.*核验/);
  });

  it("does not publish an old successful write after identity changes during cache I/O", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const held = env.holdCacheWrite();
    env.failCacheWrites(true);
    let pending = Promise.resolve();
    act(() => {
      pending = hook.result.current.commit(archive(hook.result.current.ledger));
    });
    await held.started.promise;
    env.setOffline();
    hook.rerender({
      local: {
        ...env.local,
        books: env.local.books.map((item) =>
          item.id === "personal"
            ? {
                ...item,
                cloud: { ...originalCloud, userId: "other", role: "owner" },
              }
            : item,
        ),
      },
      userId: "other",
      server: "https://test",
    });
    await act(async () => {
      held.hold.resolve();
      await pending.catch(() => undefined);
    });
    expect(env.getSnapshot().revision).toBe(2);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.network?.error).not.toMatch(/服务器已保存/);
  });
  it("rejects a captured old commit after refresh rather than reverting another member's edit", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    await advance(env, hook);
    await expect(old.commit(proposed)).rejects.toThrow(/账本.*(变化|更新)/);
    expect(env.operations).toHaveLength(0);
    expect(env.getSnapshot().ledger.records[0]).toMatchObject({
      amount: 200,
      merchant: "新商户",
    });
  });

  it("rejects an old next submitted through the latest commit when its expected revision differs", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const proposed = archive(hook.result.current.ledger);
    await advance(env, hook);
    await expect(
      hook.result.current.commit(proposed, {
        expectedRevision: 1,
        expectedCloud: originalCloud,
      }),
    ).rejects.toThrow(/账本.*(变化|更新)/);
    expect(env.operations).toHaveLength(0);
    expect(env.getSnapshot().ledger.records[0].amount).toBe(200);
  });

  it("allows an unchanged revision even when refresh replaces the snapshot objects", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    env.setSnapshot(structuredClone(env.getSnapshot()));
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.ledger).not.toBe(old.ledger);
    await act(async () => old.commit(proposed));
    expect(env.operations).toHaveLength(1);
    expect(env.operations[0].revision).toBe(1);
    expect(env.getSnapshot().ledger.accounts[0].isArchived).toBe(true);
  });

  it("uses a matching expected revision and keeps the previous mode argument compatible", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    await act(async () =>
      hook.result.current.commit(archive(hook.result.current.ledger), {
        mode: "personal",
        expectedRevision: 1,
        expectedCloud: originalCloud,
      }),
    );
    expect(env.operations[0].revision).toBe(1);
    await act(async () =>
      hook.result.current.commit(hook.result.current.ledger, "personal"),
    );
    expect(env.operations[1].revision).toBe(2);
  });

  it("requires the cloud identity when an expected revision is provided", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    await expect(
      hook.result.current.commit(archive(hook.result.current.ledger), {
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/身份/);
    expect(env.operations).toHaveLength(0);
  });

  it.each([
    { ...originalCloud, id: "remote-2" },
    { ...originalCloud, userId: "other" },
    { ...originalCloud, server: "https://other" },
  ])(
    "rejects old next after rebinding the same mode at the same revision: $id $userId $server",
    async (nextCloud) => {
      const env = fixture(),
        hook = setup(env);
      await ready(hook);
      const proposed = archive(hook.result.current.ledger);
      const snapshot = env.getSnapshot();
      env.setSnapshot({
        ...snapshot,
        id: nextCloud.id,
        ledger: {
          ...snapshot.ledger,
          records: [{ ...record, amount: 200, merchant: "新商户" }],
        },
      });
      const books = env.local.books.map((book) =>
        book.id === "personal"
          ? { ...book, cloud: { ...nextCloud, role: "owner" as const } }
          : book,
      );
      hook.rerender({
        local: { ...env.local, books },
        userId: nextCloud.userId,
        server: nextCloud.server,
      });
      await waitFor(() => {
        expect(hook.result.current.network?.isOnline).toBe(true);
        expect(hook.result.current.ledger.records[0].amount).toBe(200);
      });
      await expect(
        hook.result.current.commit(proposed, {
          mode: "personal",
          expectedRevision: 1,
          expectedCloud: originalCloud,
        }),
      ).rejects.toThrow(/账本.*(变化|切换)/);
      expect(env.operations).toHaveLength(0);
      expect(env.localCommit).not.toHaveBeenCalled();
      expect(env.getSnapshot().ledger.records[0].amount).toBe(200);
    },
  );

  it("does not fall back to local storage after the cloud binding is removed", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    hook.rerender({
      local: { ...env.local, books: DEFAULT_BOOKS },
      userId: "user",
      server: "https://test",
    });
    await expect(old.commit(proposed)).rejects.toThrow(/账本.*(变化|切换)/);
    expect(env.localCommit).not.toHaveBeenCalled();
    expect(env.operations).toHaveLength(0);
  });

  it("rejects an old callback after the cloud is detached and restored", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    hook.rerender({
      local: { ...env.local, books: DEFAULT_BOOKS },
      userId: "user",
      server: "https://test",
    });
    hook.rerender({ local: env.local, userId: "user", server: "https://test" });
    await ready(hook);
    await expect(old.commit(proposed)).rejects.toThrow(/账本.*变化/);
    expect(env.localCommit).not.toHaveBeenCalled();
    expect(env.operations).toHaveLength(0);
  });

  it("rejects an old callback after the controller is unmounted", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    hook.unmount();
    await expect(old.commit(proposed)).rejects.toThrow(/账本.*变化/);
    expect(env.operations).toHaveLength(0);
  });

  it("keeps viewer accounts read-only after an unchanged-revision refresh", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    env.setSnapshot({ ...env.getSnapshot(), role: "viewer" });
    await act(async () => hook.result.current.network?.refresh());
    await expect(old.commit(proposed)).rejects.toThrow(/只读/);
    expect(env.operations).toHaveLength(0);
  });

  it("keeps an old callback read-only after the current connection goes offline", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = hook.result.current,
      proposed = archive(old.ledger);
    env.setOffline();
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.network?.isOnline).toBe(false);
    await expect(old.commit(proposed)).rejects.toThrow(/只读/);
    expect(env.operations).toHaveLength(0);
    expect(env.localCommit).not.toHaveBeenCalled();
  });

  it.each([
    { name: "user", userId: "other", mode: "personal" as LedgerMode },
    { name: "book", userId: "user", mode: "book:other" as LedgerMode },
  ])(
    "rejects an old callback after changing $name",
    async ({ userId, mode }) => {
      const env = fixture(),
        hook = setup(env);
      await ready(hook);
      const old = hook.result.current,
        proposed = archive(old.ledger);
      const nextLocal =
        mode === "personal"
          ? env.local
          : {
              ...env.local,
              mode,
              books: [...env.local.books, { id: mode, name: "另一账本" }],
            };
      hook.rerender({ local: nextLocal, userId, server: "https://test" });
      await expect(old.commit(proposed)).rejects.toThrow(/账本.*(变化|切换)/);
      expect(env.localCommit).not.toHaveBeenCalled();
      expect(env.operations).toHaveLength(0);
    },
  );

  it("rejects an explicit network revision when the target is local", async () => {
    const setItem = vi.fn(async () => {});
    const repository = createLedgerRepository({
      getItem: async () => null,
      setItem,
    });
    const hook = renderHook(() =>
      useLedger({
        repository,
        createDemoLedger: () => ledger,
        localNow: () => "2026-11-06 12:00:00",
        newEntityId: () => "new",
      }),
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    await expect(
      hook.result.current.commit(ledger, { expectedRevision: 1 }),
    ).rejects.toThrow(/联网/);
    await expect(
      hook.result.current.commit(ledger, { expectedCloud: originalCloud }),
    ).rejects.toThrow(/联网/);
    expect(setItem).not.toHaveBeenCalled();
  });
});
