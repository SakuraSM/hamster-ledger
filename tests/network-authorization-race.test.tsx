// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type Ledger,
  type LedgerRepository,
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
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function book(name: string): Ledger {
  return {
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
  };
}
function snapshot(name = "旧身份数据", revision = 1): NetworkSnapshot {
  return {
    id: "remote",
    name: "联网账",
    role: "owner",
    revision,
    updatedAt: "2026-01-01",
    ledger: book(name),
  };
}
function controllerFor(
  ledger: Ledger,
  userId = "u",
  server = "https://test",
): LedgerController {
  return {
    books: DEFAULT_BOOKS.map((item) =>
      item.id === "personal"
        ? {
            ...item,
            cloud: { id: "remote", userId, server, role: "owner" as const },
          }
        : item,
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
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
function fixture() {
  const values = new Map<string, string>();
  let failure: Error | null = null,
    failCacheWrites = false;
  let failuresRemaining: number | null = null;
  let requestCount = 0;
  let writeCount = 0;
  let next: Promise<NetworkSnapshot> | null = null;
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (failCacheWrites && key.includes("network-cache"))
        throw new Error("缓存状态写入失败");
      values.set(key, value);
    },
  };
  const repository = createLedgerRepository(store);
  const client: NetworkClient = {
    request: async <Result,>(
      _path: string,
      options?: { method?: string; body?: unknown },
    ) => {
      requestCount += 1;
      if (options?.method === "POST") writeCount += 1;
      if (next) {
        const value = next;
        next = null;
        return (await value) as Result;
      }
      if (failure && (failuresRemaining === null || failuresRemaining > 0)) {
        if (failuresRemaining !== null) failuresRemaining -= 1;
        throw failure;
      }
      return snapshot() as Result;
    },
  };
  return {
    values,
    store,
    repository,
    client,
    setFailure: (value: Error | null) => {
      failure = value;
      failuresRemaining = null;
    },
    setFailures: (value: Error, count: number) => {
      failure = value;
      failuresRemaining = count;
    },
    requestCount: () => requestCount,
    writeCount: () => writeCount,
    failCacheWrites: (value: boolean) => {
      failCacheWrites = value;
    },
    setNext: (value: Promise<NetworkSnapshot>) => {
      next = value;
    },
  };
}
function setup(
  env: ReturnType<typeof fixture>,
  repository: LedgerRepository = env.repository,
  local = controllerFor(book("旧身份数据")),
  observations: Array<{
    account?: string;
    online?: boolean;
    revision?: number;
    commit?: LedgerController["commit"];
  }> = [],
) {
  return renderHook(
    ({ current, userId, server }) => {
      const controller = useNetworkLedger({
        local: current,
        client: env.client,
        userId,
        server,
        repository,
        newId: () => "test-operation",
      });
      useLayoutEffect(() => {
        observations.push({
          account: controller.ledger.accounts[0]?.name,
          online: controller.network?.isOnline,
          revision: controller.network?.revision,
          commit: controller.commit,
        });
      });
      return controller;
    },
    { initialProps: { current: local, userId: "u", server: "https://test" } },
  );
}
async function ready(hook: ReturnType<typeof setup>): Promise<void> {
  await waitFor(() => expect(hook.result.current.network?.isOnline).toBe(true));
}
const revoked = (): Error =>
  Object.assign(new Error("失去权限"), { status: 403 });

describe("network authorization and cache ownership", () => {
  it("rejects an old external receive after revocation and again after reauthorization", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const oldReceive = hook.result.current.network!.receive!;
    env.setFailure(revoked());
    await act(async () => hook.result.current.network?.refresh());
    await expect(oldReceive(snapshot("撤权前响应", 2))).rejects.toThrow(
      /权限|身份|变化/,
    );
    env.setFailure(null);
    env.setNext(Promise.resolve(snapshot("重新授权", 3)));
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.ledger.accounts[0].name).toBe("重新授权");
    await expect(oldReceive(snapshot("撤权前响应", 4))).rejects.toThrow(
      /权限|身份|变化/,
    );
    await act(async () =>
      hook.result.current.network?.receive?.(snapshot("新授权响应", 4)),
    );
    expect(hook.result.current.ledger.accounts[0].name).toBe("新授权响应");
  });

  it.each([
    { userId: "other", server: "https://test" },
    { userId: "u", server: "https://other" },
  ])(
    "never publishes the old remote or cache on the first frame after same-id rebind",
    async ({ userId, server }) => {
      const env = fixture(),
        seen: Array<{
          account?: string;
          online?: boolean;
          revision?: number;
          commit?: LedgerController["commit"];
        }> = [],
        hook = setup(
          env,
          env.repository,
          controllerFor(book("旧身份数据")),
          seen,
        );
      await ready(hook);
      const waiting = deferred<NetworkSnapshot>();
      env.setNext(waiting.promise);
      const before = seen.length;
      hook.rerender({
        current: controllerFor(book("旧身份数据"), userId, server),
        userId,
        server,
      });
      const first = seen[before];
      expect(first.account).toBeUndefined();
      expect(first.online).toBe(false);
      expect(first.revision).toBeUndefined();
      const writes = env.writeCount();
      await expect(first.commit!(book("旧身份写入"))).rejects.toThrow(/只读/);
      expect(env.writeCount()).toBe(writes);
      waiting.resolve(snapshot("新身份数据", 1));
    },
  );

  it("keeps verified same-identity cache readable offline after restart", async () => {
    const env = fixture(),
      first = setup(env);
    await ready(first);
    first.unmount();
    env.setFailure(new Error("offline"));
    const repository = createLedgerRepository(env.store);
    const stored = await repository.load("personal");
    const reopened = setup(
      env,
      repository,
      controllerFor(stored ?? EMPTY_LEDGER),
    );
    await waitFor(() =>
      expect(reopened.result.current.network?.error).toContain("offline"),
    );
    expect(reopened.result.current.ledger.accounts[0]?.name).toBe("旧身份数据");
    expect(reopened.result.current.network?.isOnline).toBe(false);
  });

  it("keeps a revoked cache hidden across switching contexts and restart while preserving data", async () => {
    const env = fixture();
    await env.repository.save("personal", book("本地原数据"));
    const first = setup(env);
    await ready(first);
    env.setFailure(revoked());
    await act(async () => first.result.current.network?.refresh());
    await waitFor(() =>
      expect(
        [...env.values.entries()].some(
          ([key, value]) =>
            key.includes("network-cache") && value.includes('"revoked"'),
        ),
      ).toBe(true),
    );
    expect(first.result.current.ledger.accounts).toHaveLength(0);
    first.rerender({
      current: controllerFor(book("旧身份数据"), "other", "https://test"),
      userId: "other",
      server: "https://test",
    });
    env.setFailure(new Error("offline"));
    first.rerender({
      current: controllerFor(book("旧身份数据")),
      userId: "u",
      server: "https://test",
    });
    await waitFor(() =>
      expect(first.result.current.network?.error).toContain("offline"),
    );
    expect(first.result.current.ledger.accounts).toHaveLength(0);
    first.unmount();
    const repository = createLedgerRepository(env.store),
      stored = await repository.load("personal");
    expect(stored?.accounts[0].name).toBe("本地原数据");
    const reopened = setup(
      env,
      repository,
      controllerFor(stored ?? EMPTY_LEDGER),
    );
    await waitFor(() =>
      expect(reopened.result.current.network?.error).toContain("offline"),
    );
    expect(reopened.result.current.ledger.accounts).toHaveLength(0);
  });

  it("hides unmarked or capability-less legacy caches until online confirmation", async () => {
    const env = fixture();
    env.setFailure(new Error("offline"));
    const legacy: LedgerRepository = {
      listBooks: env.repository.listBooks,
      saveBooks: env.repository.saveBooks,
      load: env.repository.load,
      save: env.repository.save,
      loadActiveMode: env.repository.loadActiveMode,
      saveActiveMode: env.repository.saveActiveMode,
    };
    const hook = setup(env, legacy, controllerFor(book("无标记缓存")));
    await waitFor(() =>
      expect(hook.result.current.network?.error).toContain("offline"),
    );
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    env.setFailure(null);
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.ledger.accounts[0].name).toBe("旧身份数据");
  });

  it("fails closed in the current session if persisting revocation fails", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    env.failCacheWrites(true);
    env.setFailure(revoked());
    await act(async () => hook.result.current.network?.refresh());
    await waitFor(() =>
      expect(hook.result.current.network?.error).toMatch(/保存|存储|缓存/),
    );
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
  });
  it("does not expose an unmarked cache with a metadata-capable repository", async () => {
    const env = fixture();
    env.setFailure(new Error("offline"));
    const hook = setup(env, env.repository, controllerFor(book("旧版缓存")));
    await waitFor(() =>
      expect(hook.result.current.network?.error).toContain("offline"),
    );
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(env.values.size).toBe(0);
  });
  it("accepts an authorized lower revision after revocation invalidated the old session", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    env.setNext(Promise.resolve(snapshot("旧授权版本三", 3)));
    await act(async () => hook.result.current.network?.refresh());
    env.setFailure(revoked());
    await act(async () => hook.result.current.network?.refresh());
    env.setFailure(null);
    env.setNext(Promise.resolve(snapshot("新授权版本二", 2)));
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(2);
    expect(hook.result.current.ledger.accounts[0].name).toBe("新授权版本二");
  });
  it("fails closed on corrupt cache metadata without overwriting it, then retries after repair", async () => {
    const env = fixture(),
      first = setup(env);
    await ready(first);
    first.unmount();
    const entry = [...env.values.entries()].find(([key]) =>
      key.includes("network-cache"),
    );
    if (!entry) throw new Error("缺少缓存信封");
    const [key, valid] = entry;
    env.values.set(key, "{corrupt");
    const reopened = setup(env, createLedgerRepository(env.store));
    await waitFor(() =>
      expect(reopened.result.current.network?.error).toContain("读取联网缓存"),
    );
    expect(reopened.result.current.ledger.accounts).toHaveLength(0);
    await act(async () => reopened.result.current.network?.refresh());
    expect(env.values.get(key)).toBe("{corrupt");
    env.values.set(key, valid);
    await act(async () => reopened.result.current.network?.refresh());
    expect(reopened.result.current.network?.isOnline).toBe(true);
  });
  it("documents that a failed 403 marker write cannot survive a restart", async () => {
    const env = fixture(),
      first = setup(env);
    await ready(first);
    env.failCacheWrites(true);
    env.setFailure(revoked());
    await act(async () => first.result.current.network?.refresh());
    expect(first.result.current.ledger.accounts).toHaveLength(0);
    first.unmount();
    env.failCacheWrites(false);
    env.setFailure(new Error("offline"));
    const repository = createLedgerRepository(env.store),
      stored = await repository.load("personal");
    const reopened = setup(
      env,
      repository,
      controllerFor(stored ?? EMPTY_LEDGER),
    );
    await waitFor(() =>
      expect(reopened.result.current.network?.error).toContain("offline"),
    );
    expect(reopened.result.current.ledger.accounts[0]?.name).toBe("旧身份数据");
  });
  it("preserves the unmarked local ledger when first verifying a network cache", async () => {
    const env = fixture();
    await env.repository.save("personal", book("旧版本地账本"));
    const hook = setup(
      env,
      env.repository,
      controllerFor(book("旧版本地账本")),
    );
    await ready(hook);
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "旧版本地账本",
    );
    expect(hook.result.current.ledger.accounts[0].name).toBe("旧身份数据");
  });
  it("does not let a late old-context write poison the new identity revision", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const oldResponse = deferred<NetworkSnapshot>();
    env.setNext(oldResponse.promise);
    let commit = Promise.resolve();
    act(() => {
      commit = hook.result.current.commit(hook.result.current.ledger);
    });
    hook.rerender({
      current: controllerFor(book("新身份"), "other", "https://other"),
      userId: "other",
      server: "https://other",
    });
    await act(async () => {
      oldResponse.resolve(snapshot("旧写入结果", 50));
      await commit;
    });
    env.setNext(Promise.resolve(snapshot("新身份版本一", 1)));
    await act(async () => hook.result.current.network?.refresh());
    expect(hook.result.current.network?.isOnline).toBe(true);
    expect(hook.result.current.network?.revision).toBe(1);
    expect(hook.result.current.ledger.accounts[0].name).toBe("新身份版本一");
  });
  it("revokes the current session when a network commit returns 403", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const oldReceive = hook.result.current.network!.receive!;
    env.setFailure(revoked());
    await act(async () => {
      await expect(
        hook.result.current.commit(hook.result.current.ledger),
      ).rejects.toThrow("失去权限");
    });
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    expect(hook.result.current.network?.isOnline).toBe(false);
    await expect(oldReceive(snapshot("旧响应", 2))).rejects.toThrow(
      /权限|身份|变化/,
    );
  });
  it("revokes the current session when undo returns 403", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    await act(async () =>
      hook.result.current.network?.receive?.({
        ...snapshot(),
        operationId: "operation",
      }),
    );
    env.setFailure(revoked());
    act(() => hook.result.current.undo());
    await waitFor(() =>
      expect(hook.result.current.network?.isOnline).toBe(false),
    );
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
  });
  it("does not let a pre-exit refresh restore explicitly revoked access", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook);
    const old = deferred<NetworkSnapshot>();
    env.setNext(old.promise);
    let refresh = Promise.resolve();
    act(() => {
      refresh = hook.result.current.network!.refresh();
    });
    await act(async () => hook.result.current.network?.revokeCache?.());
    await act(async () => {
      old.resolve(snapshot("退出前响应", 2));
      await refresh;
    });
    expect(hook.result.current.network?.isOnline).toBe(false);
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await env.repository.loadNetworkCache!(identity))?.status).toBe(
      "revoked",
    );
  });
  it("waits for a pending revocation before loading the same identity cache again", async () => {
    const env = fixture();
    const gate = deferred<void>(),
      started = deferred<void>();
    const repository: LedgerRepository = {
      ...env.repository,
      saveNetworkCache: async (identity, entry) => {
        if (entry.status === "revoked") {
          started.resolve();
          await gate.promise;
        }
        await env.repository.saveNetworkCache!(identity, entry);
      },
    };
    const hook = setup(env, repository);
    await ready(hook);
    const oldRevoke = hook.result.current.network!.revokeCache!;
    env.setFailure(new Error("offline"));
    hook.rerender({
      current: controllerFor(book("旧身份数据"), "other", "https://test"),
      userId: "other",
      server: "https://test",
    });
    let marking = Promise.resolve();
    act(() => {
      marking = oldRevoke();
    });
    await started.promise;
    hook.rerender({
      current: controllerFor(book("旧身份数据")),
      userId: "u",
      server: "https://test",
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
    await act(async () => {
      gate.resolve();
      await marking;
    });
    await waitFor(() =>
      expect(hook.result.current.network?.error).toContain("offline"),
    );
    expect(hook.result.current.ledger.accounts).toHaveLength(0);
  });
  it("invalidates all active sessions on 403 without recursive revalidation", async () => {
    const env = fixture(),
      first = setup(env),
      second = setup(env);
    await ready(first);
    await ready(second);
    env.setFailures(revoked(), 2);
    const before = env.requestCount();
    await act(async () => first.result.current.network?.refresh());
    expect(env.requestCount() - before).toBe(1);
    expect(first.result.current.network?.isOnline).toBe(false);
    expect(second.result.current.network?.isOnline).toBe(false);
    expect(first.result.current.ledger.accounts).toHaveLength(0);
    expect(second.result.current.ledger.accounts).toHaveLength(0);
  });
});
