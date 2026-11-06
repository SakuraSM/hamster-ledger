// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type Ledger,
  type LedgerRepository,
} from "@hamster-ledger/core";
import type {
  NetworkBook,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";
import { useNetworkManagement } from "../packages/ledger-react/src/useNetworkManagement";

afterEach(cleanup);
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
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
function fixture() {
  const values = new Map<string, string>();
  const events: string[] = [];
  let offline = false,
    failMarker = false;
  let nextId = "new";
  let nextBookRead: NetworkSnapshot | null = null;
  let nextBookError: Error | null = null;
  let pendingDelete: Promise<void> | null = null;
  let pendingBookRead: ReturnType<typeof deferred> | null = null;
  let bookReadStarted: ReturnType<typeof deferred> | null = null;
  let offlineAfterBookRead = false;
  let pendingCacheWrite: ReturnType<typeof deferred> | null = null;
  let cacheWriteStarted: ReturnType<typeof deferred> | null = null;
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (
        key.includes("network-cache") &&
        pendingCacheWrite &&
        cacheWriteStarted
      ) {
        const waiting = pendingCacheWrite;
        const started = cacheWriteStarted;
        pendingCacheWrite = null;
        cacheWriteStarted = null;
        started.resolve();
        await waiting.promise;
      }
      if (failMarker && key.includes("network-cache"))
        throw new Error("marker failed");
      if (key.includes("network-cache"))
        events.push(`cache:${JSON.parse(value).status}`);
      values.set(key, value);
    },
  };
  const repository = createLedgerRepository(store);
  const remote: NetworkSnapshot = {
    id: "remote",
    name: "联网账",
    revision: 2,
    updatedAt: "2026-01-01",
    role: "owner",
    ledger: book("远端最新"),
  };
  const client: NetworkClient = {
    request: async <Result,>(
      path: string,
      options?: { method?: string; body?: unknown },
    ) => {
      if (offline) throw new Error("offline");
      if (options?.method === "DELETE") {
        const waiting = pendingDelete;
        pendingDelete = null;
        if (waiting) await waiting;
        events.push("delete:complete");
        return {} as Result;
      }
      if (path === "/network/books" && options?.method === "POST")
        return {
          ...remote,
          revision: 1,
          ledger: (options.body as { ledger: Ledger }).ledger,
        } as Result;
      if (path === "/network/books") return { books: [] } as Result;
      if (path.endsWith("/members")) return { members: [] } as Result;
      if (path.endsWith("/history")) return { history: [] } as Result;
      if (path.endsWith("/invites")) return { invites: [] } as Result;
      events.push("book:read");
      if (pendingBookRead && bookReadStarted) {
        const waiting = pendingBookRead;
        const started = bookReadStarted;
        pendingBookRead = null;
        bookReadStarted = null;
        started.resolve();
        await waiting.promise;
      }
      if (nextBookError) {
        const error = nextBookError;
        nextBookError = null;
        throw error;
      }
      if (nextBookRead) {
        const value = nextBookRead;
        nextBookRead = null;
        if (offlineAfterBookRead) offline = true;
        return value as Result;
      }
      if (offlineAfterBookRead) offline = true;
      return remote as Result;
    },
  };
  return {
    values,
    events,
    store,
    repository,
    newEntityId: () => nextId,
    setNextId: (value: string) => {
      nextId = value;
    },
    remote,
    client,
    delayDelete: (value: Promise<void>) => {
      pendingDelete = value;
    },
    setNextBookError: (value: Error) => {
      nextBookError = value;
    },
    setNextBookRead: (value: NetworkSnapshot) => {
      nextBookRead = value;
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
    setFailMarker: (value: boolean) => {
      failMarker = value;
    },
    goOfflineAfterBookRead: () => {
      offlineAfterBookRead = true;
    },
    holdNextBookRead: () => {
      pendingBookRead = deferred();
      bookReadStarted = deferred();
      return { hold: pendingBookRead, started: bookReadStarted };
    },
    holdNextCacheWrite: () => {
      pendingCacheWrite = deferred();
      cacheWriteStarted = deferred();
      return { hold: pendingCacheWrite, started: cacheWriteStarted };
    },
  };
}
function setup(
  env: ReturnType<typeof fixture>,
  repository: LedgerRepository = env.repository,
  initialIdentity = { userId: "u", server: "https://test" },
) {
  return renderHook(
    ({ userId, server }: { userId: string; server: string }) => {
      const local = useLedger({
        repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: env.newEntityId,
      });
      const controller = useNetworkLedger({
        local,
        client: env.client,
        userId,
        server,
        repository,
        newId: () => "test-operation",
      });
      const manager = useNetworkManagement({
        controller,
        client: env.client,
        userId,
        server,
        prepareConversion: async () => ({}),
      });
      return { local, controller, manager };
    },
    { initialProps: initialIdentity },
  );
}
async function initialize(env: ReturnType<typeof fixture>): Promise<void> {
  await env.repository.saveBooks(DEFAULT_BOOKS);
  await env.repository.saveActiveMode("personal");
  await env.repository.save("personal", book("本机原账"));
}
async function localReady(hook: ReturnType<typeof setup>): Promise<void> {
  await waitFor(() => expect(hook.result.current.local.isLoading).toBe(false));
}
async function online(hook: ReturnType<typeof setup>): Promise<void> {
  await waitFor(() =>
    expect(hook.result.current.controller.network?.isOnline).toBe(true),
  );
}

describe("network cache migration and management", () => {
  it("retains the initial verified snapshot when the next refresh and restart are offline", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    env.goOfflineAfterBookRead();
    await act(async () => hook.result.current.manager.open(env.remote));
    await waitFor(() =>
      expect(hook.result.current.controller.network?.error).toContain(
        "offline",
      ),
    );
    expect(hook.result.current.controller.ledger.accounts[0]?.name).toBe(
      "远端最新",
    );
    expect(hook.result.current.controller.network?.isOnline).toBe(false);
    expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
      "远端最新",
    );
    hook.unmount();
    const reopened = setup(env, createLedgerRepository(env.store));
    await localReady(reopened);
    await waitFor(() =>
      expect(reopened.result.current.controller.network?.error).toContain(
        "offline",
      ),
    );
    expect(reopened.result.current.controller.ledger.accounts[0]?.name).toBe(
      "远端最新",
    );
  });
  it("rejects a late open result after switching away and back to the same identity", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    const held = env.holdNextBookRead();
    let pending = Promise.resolve();
    act(() => {
      pending = hook.result.current.manager.open(env.remote);
    });
    await held.started.promise;
    hook.rerender({ userId: "other", server: "https://test" });
    hook.rerender({ userId: "u", server: "https://test" });
    await act(async () => {
      held.hold.resolve();
      await expect(pending).rejects.toThrow(/身份|变化/);
    });
    expect(
      hook.result.current.controller.books.some(
        (item) => item.id === "book:new",
      ),
    ).toBe(false);
    expect(await env.repository.load("book:new")).toBeNull();
  });
  it("does not create or expose a new binding if identity changes during the cache write", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    const held = env.holdNextCacheWrite();
    let pending = Promise.resolve();
    act(() => {
      pending = hook.result.current.manager.open(env.remote);
    });
    await held.started.promise;
    hook.rerender({ userId: "other", server: "https://test" });
    await act(async () => {
      held.hold.resolve();
      await expect(pending).rejects.toThrow(/身份|变化/);
    });
    expect(
      hook.result.current.controller.books.some(
        (item) => item.id === "book:new",
      ),
    ).toBe(false);
    expect(await env.repository.load("book:new")).toBeNull();
    expect(
      await env.repository.loadNetworkCache!({
        mode: "book:new",
        id: "remote",
        userId: "other",
        server: "https://test",
      }),
    ).toBeNull();
  });
  it.each(["ledger", "books", "selection"])(
    "does not publish an old open in the new identity when %s storage completes late",
    async (stage) => {
      const env = fixture();
      await initialize(env);
      const held = deferred(),
        started = deferred();
      const repository: LedgerRepository = {
        ...env.repository,
        save: async (mode, ledger) => {
          if (stage === "ledger" && mode === "book:new") {
            started.resolve();
            await held.promise;
          }
          await env.repository.save(mode, ledger);
        },
        saveBooks: async (books) => {
          if (
            stage === "books" &&
            books.some((item) => item.id === "book:new")
          ) {
            started.resolve();
            await held.promise;
          }
          await env.repository.saveBooks(books);
        },
        saveActiveMode: async (mode) => {
          if (stage === "selection" && mode === "book:new") {
            started.resolve();
            await held.promise;
          }
          await env.repository.saveActiveMode(mode);
        },
      };
      const hook = setup(env, repository);
      await localReady(hook);
      let pending = Promise.resolve();
      act(() => {
        pending = hook.result.current.manager.open(env.remote);
      });
      await started.promise;
      hook.rerender({ userId: "other", server: "https://test" });
      await act(async () => {
        held.resolve();
        await expect(pending).rejects.toThrow(/身份|变化/);
      });
      expect(hook.result.current.controller.mode).toBe("personal");
      expect(
        hook.result.current.controller.books.some(
          (item) => item.id === "book:new",
        ),
      ).toBe(false);
      expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
        "远端最新",
      );
      if (stage !== "ledger")
        expect(
          (await env.repository.listBooks()).some(
            (item) => item.id === "book:new",
          ),
        ).toBe(true);
      if (stage === "selection")
        expect(await env.repository.loadActiveMode()).toBe("book:new");
      if (stage !== "ledger") {
        hook.unmount();
        const reopened = setup(env, env.repository, {
          userId: "other",
          server: "https://test",
        });
        await waitFor(() =>
          expect(reopened.result.current.controller.isLoading).toBe(false),
        );
        expect(reopened.result.current.controller.mode).toBe("personal");
        expect(
          reopened.result.current.controller.books.some(
            (item) => item.id === "book:new",
          ),
        ).toBe(false);
        reopened.rerender({ userId: "u", server: "https://test" });
        expect(
          reopened.result.current.controller.books.some(
            (item) => item.id === "book:new",
          ),
        ).toBe(true);
        act(() => reopened.result.current.controller.switchMode("book:new"));
        await online(reopened);
        expect(
          reopened.result.current.controller.ledger.accounts[0]?.name,
        ).toBe("远端最新");
      }
    },
  );
  it("does not overwrite a competing directory write when the repository detects a conflict", async () => {
    const env = fixture();
    await initialize(env);
    const held = deferred(),
      started = deferred();
    const repository: LedgerRepository = {
      ...env.repository,
      saveBooks: async (books) => {
        const before = JSON.stringify(await env.repository.listBooks());
        started.resolve();
        await held.promise;
        if (JSON.stringify(await env.repository.listBooks()) !== before)
          throw new Error("账本目录存储冲突");
        await env.repository.saveBooks(books);
      },
    };
    const hook = setup(env, repository);
    await localReady(hook);
    let pending = Promise.resolve();
    act(() => {
      pending = hook.result.current.manager.open(env.remote);
    });
    await started.promise;
    hook.rerender({ userId: "other", server: "https://test" });
    await env.repository.saveBooks([
      ...DEFAULT_BOOKS,
      { id: "book:other", name: "其他新账本" },
    ]);
    await act(async () => {
      held.resolve();
      await expect(pending).rejects.toThrow(/冲突/);
    });
    expect(hook.result.current.controller.mode).toBe("personal");
    expect(
      (await env.repository.listBooks()).some(
        (item) => item.id === "book:other",
      ),
    ).toBe(true);
    expect(
      (await env.repository.listBooks()).some((item) => item.id === "book:new"),
    ).toBe(false);
    expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
      "远端最新",
    );
  });
  it.each(["edit-first", "create-first"])(
    "preserves a late hidden directory entry with %s",
    async (order) => {
      const env = fixture();
      await initialize(env);
      const held = deferred(),
        started = deferred();
      let firstWrite = true;
      const repository: LedgerRepository = {
        ...env.repository,
        saveBooks: async (books) => {
          if (firstWrite && books.some((item) => item.id === "book:new")) {
            firstWrite = false;
            started.resolve();
            await held.promise;
          }
          await env.repository.saveBooks(books);
        },
      };
      const hook = setup(env, repository);
      await localReady(hook);
      let pending = Promise.resolve();
      act(() => {
        pending = hook.result.current.manager.open(env.remote);
      });
      await started.promise;
      hook.rerender({ userId: "other", server: "https://test" });
      await act(async () => {
        held.resolve();
        await expect(pending).rejects.toThrow(/身份|变化/);
      });
      expect(
        hook.result.current.controller.books.some(
          (item) => item.id === "book:new",
        ),
      ).toBe(false);
      await expect(
        hook.result.current.controller.createBook("立即碰撞"),
      ).rejects.toThrow(/ID|存在|冲突/);
      expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
        "远端最新",
      );
      if (order === "create-first") {
        env.setNextId("b-local");
        await act(async () =>
          hook.result.current.controller.createBook("乙的新本机账"),
        );
      }
      await act(async () =>
        hook.result.current.controller.updateBooks(
          hook.result.current.controller.books.map((item) =>
            item.id === "personal" ? { ...item, name: "乙的本机账" } : item,
          ),
        ),
      );
      expect(
        (await env.repository.listBooks()).find(
          (item) => item.id === "book:new",
        )?.name,
      ).toBe("联网账");
      if (order === "edit-first") {
        await expect(
          hook.result.current.controller.createBook("冲突本机账"),
        ).rejects.toThrow(/ID|存在|冲突/);
        expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
          "远端最新",
        );
        env.setNextId("b-local");
        await act(async () =>
          hook.result.current.controller.createBook("乙的新本机账"),
        );
      }
      expect(
        (await env.repository.listBooks()).some(
          (item) => item.id === "book:new",
        ),
      ).toBe(true);
      expect(
        (await env.repository.listBooks()).some(
          (item) => item.id === "book:b-local",
        ),
      ).toBe(true);
    },
  );
  it("rejects an old open result after revocation and reauthorization in the same context", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    const held = env.holdNextBookRead();
    let pending = Promise.resolve();
    act(() => {
      pending = hook.result.current.manager.open({
        ...env.remote,
        id: "remote-2",
      });
    });
    await held.started.promise;
    env.setNextBookError(Object.assign(new Error("失去权限"), { status: 403 }));
    await act(async () => hook.result.current.controller.network?.refresh());
    await act(async () => hook.result.current.controller.network?.refresh());
    await online(hook);
    env.setNextBookRead({ ...env.remote, id: "remote-2" });
    await act(async () => {
      held.hold.resolve();
      await expect(pending).rejects.toThrow(/身份|变化/);
    });
    expect(
      hook.result.current.controller.books.some(
        (item) => item.id === "book:new",
      ),
    ).toBe(false);
  });
  it("opens the book but reports when its initial offline cache cannot be saved", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    env.setFailMarker(true);
    env.goOfflineAfterBookRead();
    await act(async () => hook.result.current.manager.open(env.remote));
    expect(hook.result.current.controller.mode).toBe("book:new");
    expect(hook.result.current.controller.notice).toMatch(/离线缓存/);
    expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
      "远端最新",
    );
  });
  it("keeps the original local key during conversion and reopens the verified remote envelope offline", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "本机原账",
    );
    expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
    hook.unmount();
    env.setOffline(true);
    const repository = createLedgerRepository(env.store),
      reopened = setup(env, repository);
    await localReady(reopened);
    await waitFor(() =>
      expect(reopened.result.current.controller.network?.error).toContain(
        "offline",
      ),
    );
    expect(reopened.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
  });
  it("keeps the initial imported book copy distinct from later verified network cache", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    env.setNextBookRead({
      ...env.remote,
      revision: 1,
      ledger: book("初次远端"),
    });
    const remote: NetworkBook = {
      id: "remote",
      name: "联网账",
      revision: 2,
      updatedAt: "2026-01-01",
      role: "owner",
    };
    await act(async () => hook.result.current.manager.open(remote));
    await online(hook);
    expect(hook.result.current.controller.mode).toBe("book:new");
    expect((await env.repository.load("book:new"))?.accounts[0].name).toBe(
      "初次远端",
    );
    expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
    hook.unmount();
    env.setOffline(true);
    const repository = createLedgerRepository(env.store),
      reopened = setup(env, repository);
    await localReady(reopened);
    await waitFor(() =>
      expect(reopened.result.current.controller.network?.error).toContain(
        "offline",
      ),
    );
    expect(reopened.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "本机原账",
    );
  });
  it.each([false, true])(
    "keeps an explicitly exited or deleted account hidden offline (delete=%s)",
    async (remove) => {
      const env = fixture();
      await initialize(env);
      const hook = setup(env);
      await localReady(hook);
      await act(async () => hook.result.current.manager.convert());
      await online(hook);
      await act(async () => hook.result.current.manager.exitBook(remove));
      expect(hook.result.current.controller.mode).toBe("demo");
      env.setOffline(true);
      act(() => hook.result.current.controller.switchMode("personal"));
      await waitFor(() =>
        expect(hook.result.current.controller.network?.error).toContain(
          "offline",
        ),
      );
      expect(hook.result.current.controller.ledger.accounts).toHaveLength(0);
      hook.unmount();
      const repository = createLedgerRepository(env.store),
        reopened = setup(env, repository);
      await localReady(reopened);
      await waitFor(() =>
        expect(reopened.result.current.controller.network?.error).toContain(
          "offline",
        ),
      );
      expect(reopened.result.current.controller.ledger.accounts).toHaveLength(
        0,
      );
      expect((await repository.load("personal"))?.accounts[0].name).toBe(
        "本机原账",
      );
    },
  );
  it("switches away and reports persistence failure after server exit succeeds", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    env.setFailMarker(true);
    await act(async () => {
      await expect(hook.result.current.manager.exitBook(false)).rejects.toThrow(
        /退出|保存|缓存/,
      );
    });
    expect(hook.result.current.controller.mode).toBe("demo");
    expect(hook.result.current.controller.notice).toContain("重启离线");
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "本机原账",
    );
  });
  it("keeps the current book and verified cache when server exit fails", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    env.setOffline(true);
    await act(async () => {
      await expect(hook.result.current.manager.exitBook(false)).rejects.toThrow(
        "offline",
      );
    });
    expect(hook.result.current.controller.mode).toBe("personal");
    expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await env.repository.loadNetworkCache!(identity))?.status).toBe(
      "verified",
    );
  });
  it("does not let a late exit response override a newly authorized session", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    const oldExit = hook.result.current.manager.exitBook;
    const delayed = deferred();
    env.delayDelete(delayed.promise);
    let pending = Promise.resolve();
    act(() => {
      pending = oldExit(false);
    });
    act(() => hook.result.current.controller.switchMode("demo"));
    await waitFor(() =>
      expect(hook.result.current.controller.mode).toBe("demo"),
    );
    act(() => hook.result.current.controller.switchMode("personal"));
    await online(hook);
    await act(async () => {
      delayed.resolve();
      await pending;
    });
    expect(hook.result.current.controller.mode).toBe("personal");
    expect(hook.result.current.controller.network?.isOnline).toBe(true);
    expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
      "远端最新",
    );
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await env.repository.loadNetworkCache!(identity))?.status).toBe(
      "verified",
    );
    expect(env.events.lastIndexOf("book:read")).toBeGreaterThan(
      env.events.lastIndexOf("delete:complete"),
    );
    expect(env.events.lastIndexOf("cache:verified")).toBeGreaterThan(
      env.events.lastIndexOf("cache:revoked"),
    );
  });
  it("persists a late exit for the old identity after the user switched away", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    const oldExit = hook.result.current.manager.exitBook;
    const delayed = deferred();
    env.delayDelete(delayed.promise);
    let pending = Promise.resolve();
    act(() => {
      pending = oldExit(false);
    });
    act(() => hook.result.current.controller.switchMode("demo"));
    await waitFor(() =>
      expect(hook.result.current.controller.mode).toBe("demo"),
    );
    await act(async () => {
      delayed.resolve();
      await pending;
    });
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await env.repository.loadNetworkCache!(identity))?.status).toBe(
      "revoked",
    );
    env.setOffline(true);
    act(() => hook.result.current.controller.switchMode("personal"));
    await waitFor(() =>
      expect(hook.result.current.controller.network?.error).toContain(
        "offline",
      ),
    );
    expect(hook.result.current.controller.ledger.accounts).toHaveLength(0);
  });
  it("does not let an old exit response supersede reauthorization in the same context", async () => {
    const env = fixture();
    await initialize(env);
    const hook = setup(env);
    await localReady(hook);
    await act(async () => hook.result.current.manager.convert());
    await online(hook);
    const oldExit = hook.result.current.manager.exitBook;
    const delayed = deferred();
    env.delayDelete(delayed.promise);
    let pending = Promise.resolve();
    act(() => {
      pending = oldExit(false);
    });
    env.setNextBookError(Object.assign(new Error("失去权限"), { status: 403 }));
    await act(async () => hook.result.current.controller.network?.refresh());
    expect(hook.result.current.controller.network?.isOnline).toBe(false);
    await act(async () => hook.result.current.controller.network?.refresh());
    await online(hook);
    await act(async () => {
      delayed.resolve();
      await pending;
    });
    expect(hook.result.current.controller.mode).toBe("personal");
    expect(hook.result.current.controller.network?.isOnline).toBe(true);
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await env.repository.loadNetworkCache!(identity))?.status).toBe(
      "verified",
    );
  });
});
