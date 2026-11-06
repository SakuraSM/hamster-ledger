// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type KeyValueStore,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";

afterEach(cleanup);
it("re-reads a shared CAS cache after a conflicting revocation without confusing ordinary offline mode", async () => {
  const values = new Map<string, string>();
  function adapter(): KeyValueStore {
    const observed = new Map<string, string | null>();
    return {
      async getItem(key) {
        const value = values.get(key) ?? null;
        observed.set(key, value);
        return value;
      },
      async setItem(key, value) {
        if ((observed.get(key) ?? null) !== (values.get(key) ?? null))
          throw new Error("存储冲突");
        values.set(key, value);
        observed.set(key, value);
      },
    };
  }
  const repositoryA = createLedgerRepository(adapter());
  const repositoryB = createLedgerRepository(adapter());
  const snapshot: NetworkSnapshot = {
    id: "remote",
    name: "联网账本",
    revision: 1,
    updatedAt: "2026-01-01",
    role: "owner",
    ledger: {
      ...EMPTY_LEDGER,
      accounts: [
        {
          id: "cash",
          name: "旧快照",
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
              role: "owner",
            },
          }
        : book,
    ),
    ledger: EMPTY_LEDGER,
    personalLedger: EMPTY_LEDGER,
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: () => {},
    commit: async () => {},
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: () => {},
  };
  let denied = false;
  let offline = false;
  const clientA: NetworkClient = {
    request: async <Result,>() => {
      if (denied) throw Object.assign(new Error("失去权限"), { status: 403 });
      return snapshot as Result;
    },
  };
  const clientB: NetworkClient = {
    request: async <Result,>() => {
      if (offline) throw new Error("offline");
      return snapshot as Result;
    },
  };
  const setup = (repository: typeof repositoryA, client: NetworkClient) =>
    renderHook(() =>
      useNetworkLedger({
        local,
        client,
        userId: "u",
        server: "https://test",
        repository,
        newId: () => "id",
      }),
    );
  const first = setup(repositoryA, clientA);
  await waitFor(() =>
    expect(first.result.current.network?.isOnline).toBe(true),
  );
  const second = setup(repositoryB, clientB);
  await waitFor(() =>
    expect(second.result.current.network?.isOnline).toBe(true),
  );
  offline = true;
  await act(async () => second.result.current.network?.refresh());
  expect(second.result.current.network?.isOnline).toBe(false);
  expect(second.result.current.ledger.accounts[0]?.name).toBe("旧快照");
  offline = false;
  await act(async () => second.result.current.network?.refresh());
  denied = true;
  await act(async () => first.result.current.network?.refresh());
  await act(async () => second.result.current.network?.refresh());
  expect(second.result.current.network?.isOnline).toBe(false);
  expect(second.result.current.ledger.accounts).toHaveLength(0);
  offline = true;
  await act(async () => second.result.current.network?.refresh());
  expect(second.result.current.ledger.accounts).toHaveLength(0);
});
