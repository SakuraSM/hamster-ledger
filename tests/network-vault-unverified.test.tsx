// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { indexedDB, IDBDatabase } from "fake-indexeddb";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type LedgerRepository,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  NetworkClient,
  NetworkSnapshot,
} from "@hamster-ledger/ledger-react";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";
import { installStorageLocks } from "./helpers/storage-locks";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let restoreLocks: () => void;
beforeEach(() => {
  restoreLocks = installStorageLocks();
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", indexedDB);
});
afterEach(() => {
  cleanup();
  restoreLocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("fails closed when a revoked vault cannot verify the IndexedDB envelope after a server write", async () => {
  localStorage.setItem("hamster-ledger.v1.large", "x".repeat(80000));
  const vaultA = await import("../apps/web/src/platform/browser/vault");
  await vaultA.enableVault("local-test-password");
  expect(localStorage.getItem("hamster-ledger.vault.v1")).toMatch(
    /^hamster-idb:v1:/,
  );
  const repositoryA = createLedgerRepository(vaultA.protectedStore);
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
  const started = deferred(),
    release = deferred();
  const client: NetworkClient = {
    request: async <Result,>(_path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        started.resolve();
        await release.promise;
        return { ...snapshot, revision: 2 } as Result;
      }
      if (denied) throw Object.assign(new Error("失去权限"), { status: 403 });
      return snapshot as Result;
    },
  };
  const setup = (repository: LedgerRepository) =>
    renderHook(() =>
      useNetworkLedger({
        local,
        client,
        userId: "u",
        server: "https://test",
        repository,
        newId: () => "operation",
      }),
    );
  const hookA = setup(repositoryA);
  await waitFor(() =>
    expect(hookA.result.current.network?.isOnline).toBe(true),
  );
  vi.resetModules();
  const vaultB = await import("../apps/web/src/platform/browser/vault");
  await vaultB.unlockVault("local-test-password");
  const repositoryB = createLedgerRepository(vaultB.protectedStore);
  const hookB = setup(repositoryB);
  await waitFor(() =>
    expect(hookB.result.current.network?.isOnline).toBe(true),
  );
  let pending = Promise.resolve();
  act(() => {
    pending = hookB.result.current.commit(hookB.result.current.ledger);
  });
  await started.promise;
  denied = true;
  await act(async () => hookA.result.current.network?.refresh());
  denied = false;
  const identity = {
    mode: "personal" as const,
    id: "remote",
    userId: "u",
    server: "https://test",
  };
  expect((await repositoryA.loadNetworkCache!(identity))?.status).toBe(
    "revoked",
  );
  const failure = vi
    .spyOn(IDBDatabase.prototype, "transaction")
    .mockImplementation(() => {
      throw new Error("IndexedDB 临时不可读");
    });
  await act(async () => {
    release.resolve();
    await expect(pending).rejects.toThrow(/服务器已保存.*核验/);
  });
  expect(hookB.result.current.network?.isOnline).toBe(false);
  expect(hookB.result.current.ledger.accounts).toHaveLength(0);
  failure.mockRestore();
  expect((await repositoryA.loadNetworkCache!(identity))?.status).toBe(
    "revoked",
  );
  await vaultB.clearVaultSession();
  await vaultB.unlockVault("local-test-password");
  await act(async () => hookB.result.current.network?.refresh());
  expect(hookB.result.current.network?.isOnline).toBe(true);
  expect(hookB.result.current.ledger.accounts[0].name).toBe("旧快照");
  const originalWrite = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (key === "hamster-ledger.vault.v1") throw new Error("磁盘不可写");
    return originalWrite.call(this, key, value);
  });
  await act(async () =>
    hookB.result.current.commit(hookB.result.current.ledger),
  );
  expect(hookB.result.current.network?.revision).toBe(2);
  expect(hookB.result.current.network?.isOnline).toBe(true);
  expect(hookB.result.current.network?.error).toMatch(/服务器已保存.*离线缓存/);
});
