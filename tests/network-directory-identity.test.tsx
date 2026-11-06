// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type Book,
  type Ledger,
} from "@hamster-ledger/core";
import type { NetworkClient } from "@hamster-ledger/ledger-react";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";
import { queueLedgerWrite } from "../packages/ledger-react/src/ledger-write-queue";

afterEach(cleanup);
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const firstCloud: Book = {
  id: "book:a",
  name: "甲私有账本",
  cloud: { id: "remote-a", userId: "a", server: "https://test", role: "owner" },
};
const secondCloud: Book = {
  id: "book:b",
  name: "乙私有账本",
  cloud: { id: "remote-b", userId: "b", server: "https://test", role: "owner" },
};
const localBook: Book = { id: "book:local", name: "本地账本" };
function ledger(name: string): Ledger {
  return {
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name,
        kind: "asset",
        type: "现金",
        openingBalance: 100,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        isArchived: false,
        checkpoints: [],
      },
    ],
  };
}
function fixture(newId = "created") {
  const values = new Map<string, string>();
  let held: {
    started: ReturnType<typeof deferred>;
    release: ReturnType<typeof deferred>;
  } | null = null;
  let heldDirectory: {
    started: ReturnType<typeof deferred>;
    release: ReturnType<typeof deferred>;
  } | null = null;
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (key === "hamster-ledger.v1.books" && heldDirectory) {
        const current = heldDirectory;
        heldDirectory = null;
        current.started.resolve();
        await current.release.promise;
      }
      if (key === "hamster-ledger.v1.personal" && held) {
        const current = held;
        held = null;
        current.started.resolve();
        await current.release.promise;
      }
      values.set(key, value);
    },
  };
  const repository = createLedgerRepository(store);
  const client: NetworkClient = {
    request: async () => {
      throw new Error("offline");
    },
  };
  return {
    values,
    store,
    repository,
    client,
    newId,
    holdPersonalWrite: () => {
      held = { started: deferred(), release: deferred() };
      return held;
    },
    holdDirectoryWrite: () => {
      heldDirectory = { started: deferred(), release: deferred() };
      return heldDirectory;
    },
  };
}
async function seed(
  env: ReturnType<typeof fixture>,
  active: string = "book:a",
) {
  await env.repository.saveBooks([
    ...DEFAULT_BOOKS,
    firstCloud,
    secondCloud,
    localBook,
  ]);
  await env.repository.save("personal", ledger("个人本地"));
  await env.repository.save("book:a", ledger("旧主键甲"));
  await env.repository.save("book:b", ledger("旧主键乙"));
  await env.repository.save("book:local", ledger("本地"));
  await env.repository.saveActiveMode(active as "personal" | `book:${string}`);
  await env.repository.saveNetworkCache!(
    { mode: "book:a", id: "remote-a", userId: "a", server: "https://test" },
    { status: "verified", revision: 1, ledger: ledger("甲离线快照") },
  );
  await env.repository.saveNetworkCache!(
    { mode: "book:b", id: "remote-b", userId: "b", server: "https://test" },
    { status: "verified", revision: 1, ledger: ledger("乙离线快照") },
  );
}
type Identity = {
  userId: string | null;
  server: string;
  identityLoading: boolean;
};
function setup(
  env: ReturnType<typeof fixture>,
  initial: Identity,
  frames: Array<{ names: string[]; mode: string; loading: boolean }> = [],
) {
  return renderHook(
    ({ userId, server, identityLoading }: Identity) => {
      const local = useLedger({
        repository: env.repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: () => env.newId,
      });
      const controller = useNetworkLedger({
        local,
        client: env.client,
        userId,
        server,
        identityLoading,
        repository: env.repository,
        newId: () => "op",
      });
      useLayoutEffect(() => {
        frames.push({
          names: controller.books.map((book) => book.name),
          mode: controller.mode,
          loading: controller.isLoading,
        });
      });
      return { local, controller };
    },
    { initialProps: initial },
  );
}
const identity = (
  userId: string | null,
  identityLoading = false,
  server = "https://test",
): Identity => ({ userId, server, identityLoading });

it("hides other identities after restart, selects a local fallback and restores their cache on return", async () => {
  const env = fixture();
  await seed(env);
  const frames: Array<{ names: string[]; mode: string; loading: boolean }> = [];
  const hook = setup(env, identity("b"), frames);
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  expect(hook.result.current.controller.mode).toBe("personal");
  expect(
    hook.result.current.controller.books.map((item) => item.id),
  ).not.toContain("book:a");
  expect(frames.every((frame) => !frame.names.includes("甲私有账本"))).toBe(
    true,
  );
  expect(await env.repository.loadActiveMode()).toBe("personal");
  hook.rerender(identity("a"));
  expect(hook.result.current.controller.books.map((item) => item.id)).toContain(
    "book:a",
  );
  expect(
    hook.result.current.controller.books.map((item) => item.id),
  ).not.toContain("book:b");
  act(() => hook.result.current.controller.switchMode("book:a"));
  await waitFor(() =>
    expect(hook.result.current.controller.ledger.accounts[0]?.name).toBe(
      "甲离线快照",
    ),
  );
  expect(hook.result.current.controller.network?.isOnline).toBe(false);
});

it("does not switch the persisted cloud selection while identity is still loading", async () => {
  const env = fixture();
  await seed(env);
  const hook = setup(env, identity(null, true));
  await waitFor(() => expect(hook.result.current.local.isLoading).toBe(false));
  expect(hook.result.current.controller.isLoading).toBe(true);
  expect(hook.result.current.controller.network?.isIdentityBlocked).toBe(false);
  expect(
    hook.result.current.controller.books.map((item) => item.id),
  ).not.toContain("book:a");
  expect(await env.repository.loadActiveMode()).toBe("book:a");
  await expect(
    hook.result.current.controller.commit(ledger("不应写入")),
  ).rejects.toThrow(/身份|加载|账本/);
  await expect(
    hook.result.current.controller.createBook("不应创建"),
  ).rejects.toThrow(/身份|加载|账本/);
  await expect(
    hook.result.current.controller.updateBooks(
      hook.result.current.controller.books,
    ),
  ).rejects.toThrow(/身份|加载|账本/);
  await expect(
    hook.result.current.controller.editRecord({
      id: "missing",
      kind: "支出",
      category: "其他",
      account: "",
      remember: false,
    }),
  ).rejects.toThrow(/身份|加载|账本/);
  act(() => {
    hook.result.current.controller.switchMode("personal");
    hook.result.current.controller.undo();
    hook.result.current.controller.decide(
      { id: "r", leftId: "l", rightId: "r", state: "pending", reasons: [] },
      "linked",
    );
  });
  expect(await env.repository.loadActiveMode()).toBe("book:a");
  hook.rerender(identity("a"));
  await waitFor(() =>
    expect(hook.result.current.controller.ledger.accounts[0]?.name).toBe(
      "甲离线快照",
    ),
  );
  expect(hook.result.current.controller.mode).toBe("book:a");
  expect(await env.repository.loadActiveMode()).toBe("book:a");
});

it("preserves hidden books when archiving or creating visible local books", async () => {
  const env = fixture();
  await seed(env, "personal");
  const hook = setup(env, identity("b"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  const stable = hook.result.current.controller.books;
  hook.rerender(identity("b"));
  expect(hook.result.current.controller.books).toBe(stable);
  await act(async () =>
    hook.result.current.controller.updateBooks(
      hook.result.current.controller.books.map((item) =>
        item.id === "book:b" ? { ...item, isArchived: true } : item,
      ),
    ),
  );
  expect(
    (await env.repository.listBooks()).find((item) => item.id === "book:a"),
  ).toEqual(firstCloud);
  expect(
    (await env.repository.listBooks()).find((item) => item.id === "book:b")
      ?.isArchived,
  ).toBe(true);
  await act(async () =>
    hook.result.current.controller.createBook("新的本地账本"),
  );
  expect(
    (await env.repository.listBooks()).find((item) => item.id === "book:a"),
  ).toEqual(firstCloud);
  expect(
    (await env.repository.listBooks()).some(
      (item) => item.name === "新的本地账本",
    ),
  ).toBe(true);
});

it("rejects hidden IDs, forged cloud identities, archived switches and generated ID collisions", async () => {
  const env = fixture("a");
  await seed(env, "personal");
  const hook = setup(env, identity("b"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  const current = hook.result.current.controller;
  await expect(
    current.updateBooks([...current.books, { ...firstCloud, name: "伪造" }]),
  ).rejects.toThrow(/身份|冲突|账本/);
  await expect(
    current.updateBooks([
      ...current.books,
      { ...firstCloud, id: "book:forged" },
    ]),
  ).rejects.toThrow(/身份|冲突|账本/);
  await expect(
    current.updateBooks(
      current.books.map((item) =>
        item.id === "book:b" ? { id: item.id, name: item.name } : item,
      ),
    ),
  ).rejects.toThrow(/绑定|账本/);
  await expect(
    current.createBook("伪造", EMPTY_LEDGER, firstCloud.cloud),
  ).rejects.toThrow(/身份|账本/);
  await expect(current.createBook("冲突")).rejects.toThrow(/ID|冲突|存在/);
  expect((await env.repository.load("book:a"))?.accounts[0].name).toBe(
    "旧主键甲",
  );
  await act(async () =>
    current.updateBooks(
      current.books.map((item) =>
        item.id === "book:b" ? { ...item, isArchived: true } : item,
      ),
    ),
  );
  act(() => hook.result.current.controller.switchMode("book:b"));
  expect(hook.result.current.controller.mode).toBe("personal");
  act(() => hook.result.current.controller.switchMode("book:a"));
  expect(hook.result.current.controller.mode).toBe("personal");
});

it("rejects a stale directory update and keeps the newer directory intact", async () => {
  const env = fixture();
  await seed(env, "personal");
  const hook = setup(env, identity("b"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  const stale = hook.result.current.controller;
  await act(async () =>
    hook.result.current.controller.updateBooks(
      hook.result.current.controller.books.map((item) =>
        item.id === "book:local" ? { ...item, name: "新的本地名称" } : item,
      ),
    ),
  );
  await expect(stale.updateBooks(stale.books)).rejects.toThrow(/目录|变化/);
  expect(
    (await env.repository.listBooks()).find((item) => item.id === "book:local")
      ?.name,
  ).toBe("新的本地名称");
  expect(
    (await env.repository.listBooks()).find((item) => item.id === "book:a"),
  ).toEqual(firstCloud);
});

it("hides a same-user cloud account from another server", async () => {
  const env = fixture();
  await seed(env);
  const hook = setup(env, identity("a", false, "https://other"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  expect(hook.result.current.controller.mode).toBe("personal");
  expect(
    hook.result.current.controller.books.some((item) => item.id === "book:a"),
  ).toBe(false);
});

it("reports an unavailable local fallback without exposing either cloud book", async () => {
  const env = fixture();
  await env.repository.saveBooks([
    { ...DEFAULT_BOOKS[0], cloud: firstCloud.cloud },
    { ...DEFAULT_BOOKS[1], cloud: firstCloud.cloud },
  ]);
  await env.repository.saveActiveMode("personal");
  const hook = setup(env, identity("b"));
  await waitFor(() => expect(hook.result.current.local.isLoading).toBe(false));
  expect(hook.result.current.controller.isLoading).toBe(true);
  expect(hook.result.current.controller.error).toMatch(/没有可用的本地账本/);
  expect(hook.result.current.controller.network?.isIdentityBlocked).toBe(true);
  expect(hook.result.current.controller.books).toHaveLength(0);
  expect(hook.result.current.controller.ledger.accounts).toHaveLength(0);
  expect(await env.repository.loadActiveMode()).toBe("personal");
});

it("does not expose a cloud-bound personal ledger and falls back to demo for another identity", async () => {
  const env = fixture();
  const personal = { ...DEFAULT_BOOKS[1], cloud: firstCloud.cloud };
  await env.repository.saveBooks([DEFAULT_BOOKS[0], personal, secondCloud]);
  await env.repository.save("personal", ledger("甲个人旧副本"));
  await env.repository.saveActiveMode("personal");
  const hook = setup(env, identity("b"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  expect(hook.result.current.controller.mode).toBe("demo");
  expect(hook.result.current.controller.personalLedger.accounts).toHaveLength(
    0,
  );
  expect(
    hook.result.current.controller.books.map((item) => item.id),
  ).not.toContain("personal");
  hook.rerender(identity("a"));
  expect(hook.result.current.controller.personalLedger.accounts).toHaveLength(
    0,
  );
});

it("rejects an old identity's local write before the queued save begins", async () => {
  const env = fixture();
  await seed(env, "personal");
  const hook = setup(env, identity("a"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  const blocked = deferred(),
    started = deferred();
  const first = queueLedgerWrite({
    repository: env.repository,
    mode: "personal",
    write: async () => {
      started.resolve();
      await blocked.promise;
    },
  });
  await started.promise;
  let pending = Promise.resolve();
  act(() => {
    pending = hook.result.current.controller.commit(ledger("甲的下载"));
  });
  hook.rerender(identity("b"));
  await act(async () => {
    blocked.resolve();
    await first;
    await expect(pending).rejects.toThrow(/身份|变化/);
  });
  expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
    "个人本地",
  );
  expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
    "个人本地",
  );
});

it("does not publish an in-flight old identity write even though an already-started store write cannot be cancelled", async () => {
  const env = fixture();
  await seed(env, "personal");
  const hook = setup(env, identity("a"));
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  const held = env.holdPersonalWrite();
  let pending = Promise.resolve();
  act(() => {
    pending = hook.result.current.controller.commit(ledger("甲的下载"));
  });
  await held.started.promise;
  hook.rerender(identity("b"));
  await act(async () => {
    held.release.resolve();
    await expect(pending).rejects.toThrow(/身份|变化/);
  });
  expect(hook.result.current.controller.ledger.accounts[0].name).toBe(
    "个人本地",
  );
  expect(hook.result.current.controller.error).toMatch(/可能已写入/);
  expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
    "甲的下载",
  );
});

it("serializes concurrent directory writes in one repository and rejects a stale snapshot", async () => {
  const env = fixture();
  await seed(env, "personal");
  const first = setup(env, identity("b")),
    second = setup(env, identity("b"));
  await waitFor(() =>
    expect(first.result.current.controller.isLoading).toBe(false),
  );
  await waitFor(() =>
    expect(second.result.current.controller.isLoading).toBe(false),
  );
  const held = env.holdDirectoryWrite();
  let update = Promise.resolve();
  let create: Promise<unknown> = Promise.resolve(undefined);
  act(() => {
    update = first.result.current.controller.updateBooks(
      first.result.current.controller.books.map((book) =>
        book.id === "book:local" ? { ...book, name: "并发更新的本地账" } : book,
      ),
    );
  });
  await held.started.promise;
  act(() => {
    create = second.result.current.controller.createBook("并发新本地账");
  });
  await waitFor(async () =>
    expect(await env.repository.load("book:created")).not.toBeNull(),
  );
  await act(async () => {
    held.release.resolve();
    await update;
    await expect(create).rejects.toThrow(/目录|变化|冲突/);
  });
  const books = await env.repository.listBooks();
  expect(books.find((item) => item.id === "book:local")?.name).toBe(
    "并发更新的本地账",
  );
  expect(books.find((item) => item.id === "book:a")).toEqual(firstCloud);
  expect(books.some((item) => item.id === "book:created")).toBe(false);
});
