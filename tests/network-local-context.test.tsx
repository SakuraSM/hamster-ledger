// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  STORAGE_PREFIX,
  createLedgerRepository,
  type Book,
  type Ledger,
} from "@hamster-ledger/core";
import { useLedger } from "../packages/ledger-react/src/useLedger";

afterEach(cleanup);
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
  const values = new Map<string, string>([
    [STORAGE_PREFIX + "active", "personal"],
  ]);
  const repository = createLedgerRepository({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  });
  const bound: Book[] = DEFAULT_BOOKS.map((item) =>
    item.id === "personal"
      ? {
          ...item,
          cloud: {
            id: "remote",
            userId: "u",
            server: "https://test",
            role: "owner" as const,
          },
        }
      : item,
  );
  const hook = renderHook(() =>
    useLedger({
      repository,
      createDemoLedger: () => EMPTY_LEDGER,
      localNow: () => "2026-11-07 12:00:00",
      newEntityId: () => "test",
    }),
  );
  return { repository, bound, hook };
}
async function ready(hook: ReturnType<typeof fixture>["hook"]): Promise<void> {
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
}

describe("stale local callbacks after network binding", () => {
  it("rejects an old local commit after the same mode is bound to cloud", async () => {
    const env = fixture();
    await ready(env.hook);
    await act(async () => env.hook.result.current.commit(book("原账本")));
    const oldCommit = env.hook.result.current.commit;
    await act(async () => env.hook.result.current.updateBooks(env.bound));
    await expect(oldCommit(book("旧草稿"))).rejects.toThrow(/绑定|变化|联网/);
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "原账本",
    );
  });
  it("does not execute an old local undo after the same mode is bound to cloud", async () => {
    const env = fixture();
    await ready(env.hook);
    await act(async () => env.hook.result.current.commit(book("本地修改")));
    const oldUndo = env.hook.result.current.undo;
    await act(async () => env.hook.result.current.updateBooks(env.bound));
    await act(async () => {
      oldUndo();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "本地修改",
    );
  });
  it("keeps an old callback invalid after binding and detaching the same mode", async () => {
    const env = fixture();
    await ready(env.hook);
    await act(async () => env.hook.result.current.commit(book("原账本")));
    const oldCommit = env.hook.result.current.commit;
    await act(async () => env.hook.result.current.updateBooks(env.bound));
    await act(async () => env.hook.result.current.updateBooks(DEFAULT_BOOKS));
    await expect(oldCommit(book("旧草稿"))).rejects.toThrow(/绑定|变化|联网/);
    expect((await env.repository.load("personal"))?.accounts[0].name).toBe(
      "原账本",
    );
  });
});
