// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";

afterEach(cleanup);
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Value>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function snapshot(revision: number, name = "初始账户"): NetworkSnapshot {
  return {
    id: "remote",
    name: "联网账本",
    revision,
    updatedAt: "2026-01-01",
    role: "owner",
    ledger: {
      ...EMPTY_LEDGER,
      accounts: [
        {
          id: "cash",
          name,
          kind: "asset",
          type: "现金",
          openingBalance: 10000,
          balanceAt: "2026-01-01 00:00:00",
          aliases: [],
          isArchived: false,
          checkpoints: [],
        },
      ],
    },
  };
}
function fixture() {
  const initial = snapshot(1);
  const pending: Array<Promise<NetworkSnapshot>> = [];
  const client: NetworkClient = {
    request: async <Result,>(_path: string, options?: { method?: string }) =>
      JSON.parse(
        JSON.stringify(
          options?.method === "POST"
            ? { ...snapshot(2, "提交结果"), operationId: "operation" }
            : await (pending.shift() ?? Promise.resolve(initial)),
        ),
      ) as Result,
  };
  const local: LedgerController = {
    books: DEFAULT_BOOKS.map((book) =>
      book.id === "personal"
        ? {
            ...book,
            cloud: {
              id: "remote",
              userId: "u",
              server: "https://test",
              role: "owner" as const,
            },
          }
        : book,
    ),
    ledger: initial.ledger,
    personalLedger: initial.ledger,
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
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
  const store = new Map<string, string>();
  const base = createLedgerRepository({
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => {
      store.set(key, value);
    },
  });
  const saveCalls: Array<string | undefined> = [];
  let hold: ReturnType<typeof deferred<void>> | null = null;
  let started: ReturnType<typeof deferred<void>> | null = null;
  const repository = {
    ...base,
    saveNetworkCache: async (
      ...args: Parameters<NonNullable<typeof base.saveNetworkCache>>
    ) => {
      saveCalls.push(args[1].ledger?.accounts[0]?.name);
      const activeHold = hold,
        activeStarted = started;
      hold = null;
      started = null;
      if (activeHold && activeStarted) {
        activeStarted.resolve();
        await activeHold.promise;
      }
      await base.saveNetworkCache!(...args);
    },
  };
  return {
    initial,
    client,
    local,
    repository,
    pending,
    saveCalls,
    holdNextSave: () => {
      hold = deferred<void>();
      started = deferred<void>();
      return { hold, started };
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
async function ready(hook: ReturnType<typeof setup>): Promise<void> {
  await waitFor(() => expect(hook.result.current.network?.isOnline).toBe(true));
}
function startTwo(
  hook: ReturnType<typeof setup>,
): [Promise<void>, Promise<void>] {
  let first = Promise.resolve(),
    second = Promise.resolve();
  act(() => {
    first = hook.result.current.network!.refresh();
    second = hook.result.current.network!.refresh();
  });
  return [first, second];
}
const revoked = (): Error =>
  Object.assign(new Error("失去权限"), { status: 403 });

describe("network refresh ordering", () => {
  it("does not let an older success restore data after a newer 403", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>(),
      newer = deferred<NetworkSnapshot>();
    env.pending.push(old.promise, newer.promise);
    const [first, second] = startTwo(hook);
    await act(async () => {
      newer.reject(revoked());
      await second;
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    await act(async () => {
      old.resolve(snapshot(1));
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(hook.result.current.network?.error).toContain("失去权限");
  });
  it("ignores an older 403 after a newer successful refresh", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>(),
      newer = deferred<NetworkSnapshot>();
    env.pending.push(old.promise, newer.promise);
    const [first, second] = startTwo(hook);
    await act(async () => {
      newer.resolve(snapshot(2, "新账户"));
      await second;
    });
    await act(async () => {
      old.reject(revoked());
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(2);
    expect(hook.result.current.ledger.accounts[0].name).toBe("新账户");
  });
  it("does not publish a stale cache write that finishes after revocation", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const save = env.holdNextSave();
    const old = deferred<NetworkSnapshot>(),
      newer = deferred<NetworkSnapshot>();
    env.pending.push(old.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () => {
      old.resolve(snapshot(2, "旧响应"));
      await save.started.promise;
    });
    env.pending.push(newer.promise);
    let second = Promise.resolve();
    act(() => {
      second = hook.result.current.network!.refresh();
    });
    await act(async () => {
      newer.reject(revoked());
      await Promise.resolve();
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    await act(async () => {
      save.hold.resolve();
      await Promise.all([first, second]);
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(hook.result.current.network?.error).toContain("失去权限");
  });
  it("accepts a later same-revision refresh and reconnects after revocation", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const denied = deferred<NetworkSnapshot>();
    env.pending.push(denied.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () => {
      denied.reject(revoked());
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    const recovered = deferred<NetworkSnapshot>();
    env.pending.push(recovered.promise);
    let second = Promise.resolve();
    act(() => {
      second = hook.result.current.network!.refresh();
    });
    await act(async () => {
      recovered.resolve(snapshot(1));
      await second;
    });
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(1);
    expect(hook.result.current.ledger.accounts[0].name).toBe("初始账户");
  });
  it("publishes a completed refresh while a newer request is still pending", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const firstResponse = deferred<NetworkSnapshot>(),
      secondResponse = deferred<NetworkSnapshot>();
    env.pending.push(firstResponse.promise, secondResponse.promise);
    const [first, second] = startTwo(hook);
    await act(async () => {
      firstResponse.resolve(snapshot(2, "较早完成"));
      await first;
    });
    const visibleAfterFirst = hook.result.current.ledger.accounts[0]?.name;
    await act(async () => {
      secondResponse.resolve(snapshot(3, "较晚完成"));
      await second;
    });
    expect(visibleAfterFirst).toBe("较早完成");
    expect(hook.result.current.ledger.accounts[0].name).toBe("较晚完成");
  });
  it("skips a queued stale response before it writes to cache", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const held = env.holdNextSave();
    const firstResponse = deferred<NetworkSnapshot>();
    env.pending.push(firstResponse.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () => {
      firstResponse.resolve(snapshot(2, "已开始的旧写"));
      await held.started.promise;
    });
    const queuedResponse = deferred<NetworkSnapshot>();
    env.pending.push(queuedResponse.promise);
    let queued = Promise.resolve();
    act(() => {
      queued = hook.result.current.network!.refresh();
    });
    await act(async () => {
      queuedResponse.resolve(snapshot(3, "排队的旧响应"));
      await Promise.resolve();
      await Promise.resolve();
    });
    const denied = deferred<NetworkSnapshot>();
    env.pending.push(denied.promise);
    let latest = Promise.resolve();
    act(() => {
      latest = hook.result.current.network!.refresh();
    });
    await act(async () => {
      denied.reject(revoked());
      await Promise.resolve();
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    await act(async () => {
      held.hold.resolve();
      await Promise.all([first, queued, latest]);
    });
    expect(env.saveCalls).not.toContain("排队的旧响应");
    expect(hook.result.current.network?.isOnline).toBe(false);
  });
  it("ignores an old denial after leaving and reopening the same cloud context", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>();
    env.pending.push(old.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    hook.rerender({ local: { ...env.local, books: DEFAULT_BOOKS } });
    hook.rerender({ local: env.local });
    await ready(hook);
    await act(async () => {
      old.reject(revoked());
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.ledger.accounts[0].name).toBe("初始账户");
  });
  it("does not let an older 403 override a later successful commit", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>();
    env.pending.push(old.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () =>
      hook.result.current.commit(hook.result.current.ledger),
    );
    await act(async () => {
      old.reject(revoked());
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(2);
    expect(hook.result.current.ledger.accounts[0].name).toBe("提交结果");
  });
  it("does not let an older 403 override a received newer snapshot", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>();
    env.pending.push(old.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () =>
      hook.result.current.network?.receive?.(snapshot(2, "新通知")),
    );
    await act(async () => {
      old.reject(revoked());
      await first;
    });
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(2);
    expect(hook.result.current.ledger.accounts[0].name).toBe("新通知");
  });
  it("does not regress from a newer revision that is still being cached", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const held = env.holdNextSave();
    const newerRevision = deferred<NetworkSnapshot>();
    env.pending.push(newerRevision.promise);
    let first = Promise.resolve();
    act(() => {
      first = hook.result.current.network!.refresh();
    });
    await act(async () => {
      newerRevision.resolve(snapshot(3, "版本三"));
      await held.started.promise;
    });
    const olderRevision = deferred<NetworkSnapshot>();
    env.pending.push(olderRevision.promise);
    let second = Promise.resolve();
    act(() => {
      second = hook.result.current.network!.refresh();
    });
    await act(async () => {
      olderRevision.resolve(snapshot(2, "版本二"));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      held.hold.resolve();
      await Promise.all([first, second]);
    });
    expect(hook.result.current.network?.revision).toBe(3);
    expect(hook.result.current.ledger.accounts[0].name).toBe("版本三");
    expect(
      (
        await env.repository.loadNetworkCache!({
          mode: "personal",
          id: "remote",
          userId: "u",
          server: "https://test",
        })
      )?.ledger?.accounts[0].name,
    ).toBe("版本三");
  });
});
