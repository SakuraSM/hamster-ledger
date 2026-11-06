// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  type Book,
  type Ledger,
  type LedgerMode,
  type LedgerRepository,
  type NetworkCacheEntry,
} from "@hamster-ledger/core";
import type {
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { queueLedgerWrite } from "../packages/ledger-react/src/ledger-write-queue";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";

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
function fixture(connected = true) {
  const cloud = {
    id: "remote",
    userId: "u",
    server: "https://test",
    role: "owner" as const,
  };
  const onlineBooks: Book[] = DEFAULT_BOOKS.map((item) =>
    item.id === "personal" ? { ...item, cloud } : item,
  );
  let books: Book[] = connected ? onlineBooks : DEFAULT_BOOKS;
  const stored = new Map<LedgerMode, Ledger>([
    ["personal", book("本地初始")],
    ["demo", book("演示")],
  ]);
  let remote: NetworkSnapshot = {
    id: "remote",
    name: "联网",
    revision: 1,
    updatedAt: "2026-01-01",
    role: "owner",
    ledger: book("网络初始"),
  };
  let held: {
    name: string;
    gate: ReturnType<typeof deferred>;
    started: ReturnType<typeof deferred>;
  } | null = null;
  let failName = "";
  const writes: string[] = [];
  const caches = new Map<string, NetworkCacheEntry>();
  const repository: LedgerRepository = {
    listBooks: async () => books,
    saveBooks: async (next) => {
      books = next;
    },
    load: async (mode) => stored.get(mode) ?? null,
    save: async (mode, ledger) => {
      const name = ledger.accounts[0]?.name;
      writes.push(`ledger:${name ?? ""}`);
      if (name === failName) {
        failName = "";
        throw new Error("存储失败");
      }
      if (held && name === held.name) {
        const current = held;
        held = null;
        current.started.resolve();
        await current.gate.promise;
      }
      stored.set(mode, ledger);
    },
    loadNetworkCache: async (identity) =>
      caches.get(JSON.stringify(identity)) ?? null,
    saveNetworkCache: async (identity, entry) => {
      const name = entry.ledger?.accounts[0]?.name;
      writes.push(`cache:${name ?? ""}`);
      if (held && name === held.name) {
        const current = held;
        held = null;
        current.started.resolve();
        await current.gate.promise;
      }
      caches.set(JSON.stringify(identity), entry);
    },
    loadActiveMode: async () => "personal",
    saveActiveMode: async () => {},
  };
  const client: NetworkClient = {
    request: async <Result,>() => remote as Result,
  };
  return {
    repository,
    client,
    onlineBooks,
    stored,
    writes,
    setRemote: (value: NetworkSnapshot) => {
      remote = value;
    },
    failOnce: (name: string) => {
      failName = name;
    },
    holdNext: (name: string) => {
      const entry = { name, gate: deferred(), started: deferred() };
      held = entry;
      return entry;
    },
  };
}
function setup(env: ReturnType<typeof fixture>) {
  return renderHook(() => {
    const local = useLedger({
      repository: env.repository,
      createDemoLedger: () => book("演示"),
      localNow: () => "2026-11-07 12:00:00",
      newEntityId: () => "test",
    });
    const controller = useNetworkLedger({
      local,
      client: env.client,
      userId: "u",
      server: "https://test",
      repository: env.repository,
      newId: () => "test-operation",
    });
    return { local, controller };
  });
}
async function ready(
  hook: ReturnType<typeof setup>,
  isConnected: boolean,
): Promise<void> {
  await waitFor(() => {
    expect(hook.result.current.local.isLoading).toBe(false);
    expect(hook.result.current.controller.network?.isConnected).toBe(
      isConnected,
    );
    if (isConnected)
      expect(hook.result.current.controller.network?.isOnline).toBe(true);
  });
}
async function detach(hook: ReturnType<typeof setup>): Promise<void> {
  await act(async () => hook.result.current.local.updateBooks(DEFAULT_BOOKS));
  await ready(hook, false);
}

describe("local and network writes to the same ledger", () => {
  it("persists the newer local edit after an already-started stale remote cache write", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, true);
    const hold = env.holdNext("旧远端");
    env.setRemote({
      id: "remote",
      name: "联网",
      revision: 2,
      updatedAt: "2026-01-01",
      role: "owner",
      ledger: book("旧远端"),
    });
    let refresh = Promise.resolve();
    act(() => {
      refresh = hook.result.current.controller.network!.refresh();
    });
    await hold.started.promise;
    await detach(hook);
    let localWrite = Promise.resolve();
    act(() => {
      localWrite = hook.result.current.controller.commit(book("新本地"));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(env.writes).not.toContain("ledger:新本地");
    await act(async () => {
      hold.gate.resolve();
      await Promise.all([refresh, localWrite]);
    });
    expect(env.stored.get("personal")?.accounts[0].name).toBe("新本地");
    expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
      "新本地",
    );
  });
  it("queues a local undo behind an in-flight cache write", async () => {
    const env = fixture(false),
      hook = setup(env);
    await ready(hook, false);
    await act(async () =>
      hook.result.current.controller.commit(book("本地修改")),
    );
    const hold = env.holdNext("旧远端");
    env.setRemote({
      id: "remote",
      name: "联网",
      revision: 1,
      updatedAt: "2026-01-01",
      role: "owner",
      ledger: book("旧远端"),
    });
    await act(async () =>
      hook.result.current.local.updateBooks(env.onlineBooks),
    );
    await hold.started.promise;
    await detach(hook);
    act(() => hook.result.current.controller.undo());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(env.writes).not.toContain("ledger:本地初始");
    await act(async () => {
      hold.gate.resolve();
    });
    await waitFor(() =>
      expect(env.stored.get("personal")?.accounts[0].name).toBe("本地初始"),
    );
  });
  it("continues after a failed write", async () => {
    const env = fixture(false),
      hook = setup(env);
    await ready(hook, false);
    env.failOnce("失败写入");
    await act(async () => {
      await expect(
        hook.result.current.controller.commit(book("失败写入")),
      ).rejects.toThrow("存储失败");
    });
    await act(async () =>
      hook.result.current.controller.commit(book("恢复写入")),
    );
    expect(env.stored.get("personal")?.accounts[0].name).toBe("恢复写入");
  });
  it("does not block writes to another mode", async () => {
    const env = fixture(),
      hook = setup(env);
    await ready(hook, true);
    const hold = env.holdNext("旧远端");
    env.setRemote({
      id: "remote",
      name: "联网",
      revision: 2,
      updatedAt: "2026-01-01",
      role: "owner",
      ledger: book("旧远端"),
    });
    let refresh = Promise.resolve();
    act(() => {
      refresh = hook.result.current.controller.network!.refresh();
    });
    await hold.started.promise;
    await act(async () =>
      hook.result.current.local.commit(book("另一账本"), "demo"),
    );
    expect(env.stored.get("demo")?.accounts[0].name).toBe("另一账本");
    await act(async () => {
      hold.gate.resolve();
      await refresh;
    });
  });
  it("queues a newly created book behind an earlier write for the same mode", async () => {
    const env = fixture(false),
      hook = setup(env);
    await ready(hook, false);
    const gate = deferred(),
      started = deferred();
    const old = queueLedgerWrite({
      repository: env.repository,
      mode: "book:test",
      write: async () => {
        started.resolve();
        await gate.promise;
        await env.repository.save("book:test", book("旧缓存"));
      },
    });
    await started.promise;
    let created = Promise.resolve<LedgerMode>("personal");
    act(() => {
      created = hook.result.current.local.createBook("新账本", book("新账本"));
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      gate.resolve();
      await Promise.all([old, created]);
    });
    expect(env.stored.get("book:test")?.accounts[0].name).toBe("新账本");
  });
  it("continues a queued write when the preceding write rejects", async () => {
    const env = fixture(false);
    let rejectFirst!: (error: Error) => void;
    const firstGate = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const first = queueLedgerWrite({
      repository: env.repository,
      mode: "personal",
      write: () => firstGate,
    });
    const second = queueLedgerWrite({
      repository: env.repository,
      mode: "personal",
      write: () => env.repository.save("personal", book("后续写入")),
    });
    const failure = expect(first).rejects.toThrow("前次失败");
    rejectFirst(new Error("前次失败"));
    await failure;
    await second;
    expect(env.stored.get("personal")?.accounts[0].name).toBe("后续写入");
  });
});
