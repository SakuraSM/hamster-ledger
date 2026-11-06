// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
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

let restoreLocks: () => void;
beforeEach(() => {
  restoreLocks = installStorageLocks();
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  cleanup();
  restoreLocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["refresh", "commit", "undo"])(
  "hides a stale encrypted session on %s after another session persists revocation",
  async (operation) => {
    const first = await import("../apps/web/src/platform/browser/vault");
    await first.enableVault("local-test-password");
    const firstRepository = createLedgerRepository(first.protectedStore);
    let snapshot: NetworkSnapshot = {
      id: "remote",
      name: "联网账本",
      revision: 1,
      operationId: "original-operation",
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
    const client: NetworkClient = {
      request: async <Result,>(
        _path: string,
        options?: { method?: string },
      ) => {
        if (denied) throw Object.assign(new Error("失去权限"), { status: 403 });
        if (offline) throw new Error("offline");
        if (options?.method === "POST")
          snapshot = { ...snapshot, revision: snapshot.revision + 1 };
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
          newId: () => "id",
        }),
      );
    const hookA = setup(firstRepository);
    await waitFor(() =>
      expect(hookA.result.current.network?.isOnline).toBe(true),
    );
    vi.resetModules();
    const second = await import("../apps/web/src/platform/browser/vault");
    await second.unlockVault("local-test-password");
    const secondRepository = createLedgerRepository(second.protectedStore);
    const hookB = setup(secondRepository);
    await waitFor(() =>
      expect(hookB.result.current.network?.isOnline).toBe(true),
    );
    denied = true;
    await act(async () => hookA.result.current.network?.refresh());
    denied = false;
    const identity = {
      mode: "personal" as const,
      id: "remote",
      userId: "u",
      server: "https://test",
    };
    expect((await firstRepository.loadNetworkCache!(identity))?.status).toBe(
      "revoked",
    );
    // Its stale decrypted view is no longer accepted as a fresh cache read.
    await expect(
      secondRepository.loadNetworkCache!(identity),
    ).rejects.toMatchObject({
      code: "LEDGER_STORAGE_CONFLICT",
    });
    if (operation === "commit") {
      await act(async () => {
        await expect(
          hookB.result.current.commit(hookB.result.current.ledger),
        ).rejects.toThrow(/服务器已保存.*联网/);
      });
      expect(snapshot.revision).toBe(2);
    } else if (operation === "undo") {
      act(() => hookB.result.current.undo());
      await waitFor(() =>
        expect(hookB.result.current.network?.error).toMatch(/服务器已保存/),
      );
      expect(snapshot.revision).toBe(2);
    } else await act(async () => hookB.result.current.network?.refresh());
    expect(hookB.result.current.network?.isOnline).toBe(false);
    expect(hookB.result.current.ledger.accounts).toHaveLength(0);
    expect(hookB.result.current.network?.error).toMatch(/重新|解锁|联网/);
    offline = true;
    await act(async () => hookB.result.current.network?.refresh());
    expect(hookB.result.current.ledger.accounts).toHaveLength(0);
  },
);
