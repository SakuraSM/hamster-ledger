import { snapshotSyncAction } from "@hamster-ledger/core";
import { useAuth } from "../auth/auth-context";
const CONFLICT_STATUS = 409;
const SYNC_DEBOUNCE_MS = 1200;
import { useEffect, useRef, useState } from "react";
import {
  cloud,
  CloudError,
  type CloudBook,
  type CloudSnapshot,
} from "../platform/browser/cloud";
import { protectedStore } from "../platform/browser/vault";
import type { LedgerController } from "./useLedger";
const SYNC_INTERVAL_MS = 15000;
import { fingerprint, linkKey, type Link } from "../platform/browser/sync-link";
import type { CloudController } from "./cloud-controller";
export type { CloudController } from "./cloud-controller";
const nameOf = (value: LedgerController): string | undefined =>
  value.books.find((book) => book.id === value.mode)?.name;
interface SyncState {
  generation: number;
  books: CloudBook[];
  isBusy: boolean;
  message: string;
  error: string;
  preview: CloudSnapshot | null;
  isLinked: boolean;
}
function emptyState(generation: number): SyncState {
  return {
    generation,
    books: [],
    isBusy: false,
    message: "",
    error: "",
    preview: null,
    isLinked: false,
  };
}
export function useCloudSync(controller: LedgerController): CloudController {
  const auth = useAuth();
  const { user } = auth;
  const cloudBook = controller.books.find(
    (book) => book.id === controller.mode,
  )?.cloud;
  const accountKey = JSON.stringify([
    user?.id ?? null,
    auth.session?.id ?? null,
    location.origin,
  ]);
  const contextKey = JSON.stringify([
    accountKey,
    controller.mode,
    cloudBook?.id ?? null,
    cloudBook?.userId ?? null,
    cloudBook?.server ?? null,
  ]);
  const context = useRef({ key: contextKey, generation: 0 });
  const account = useRef({ key: accountKey, generation: 0 });
  if (context.current.key !== contextKey)
    context.current = {
      key: contextKey,
      generation: context.current.generation + 1,
    };
  if (account.current.key !== accountKey)
    account.current = {
      key: accountKey,
      generation: account.current.generation + 1,
    };
  const generation = context.current.generation;
  const accountGeneration = account.current.generation;
  const [state, setState] = useState<SyncState>(() => emptyState(generation));
  if (state.generation !== generation) setState(emptyState(generation));
  const visible =
    state.generation === generation ? state : emptyState(generation);
  const { books, isBusy, message, error, preview, isLinked } = visible;
  const current = useRef(controller);
  current.current = controller;
  const currentAuth = useRef(auth);
  currentAuth.current = auth;
  const lock = useRef<number | null>(null);
  const conflict = useRef(false);
  const conflictGeneration = useRef(generation);
  if (conflictGeneration.current !== generation) {
    conflict.current = false;
    conflictGeneration.current = generation;
  }
  const active = useRef(true);
  function isCurrent(): boolean {
    return (
      active.current &&
      context.current.key === contextKey &&
      context.current.generation === generation
    );
  }
  function assertCurrent(): void {
    if (
      !isCurrent() ||
      !user ||
      current.current.isLoading ||
      current.current.network?.isConnected
    )
      throw new Error("当前账本或登录状态已变化，请重新打开同步页面。");
    if (currentAuth.current.isOffline)
      throw new CloudError(0, "同步服务暂时不可用，请重新连接。 ");
  }
  function patch(value: Partial<SyncState>): void {
    if (!isCurrent()) return;
    setState((previous) =>
      previous.generation === generation ? { ...previous, ...value } : previous,
    );
  }
  const setBooks = (value: CloudBook[]): void => patch({ books: value });
  const setIsBusy = (value: boolean): void => patch({ isBusy: value });
  const setMessage = (value: string): void => patch({ message: value });
  const setError = (value: string): void => patch({ error: value });
  const setPreview = (value: CloudSnapshot | null): void =>
    patch({ preview: value });
  const setIsLinked = (value: boolean): void => patch({ isLinked: value });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (user)
      void cloud
        .books(user.id)
        .then((result) => {
          if (!cancelled) setBooks(result.books);
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setError(
              cause instanceof Error ? cause.message : "读取云端账本失败。",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [contextKey, generation]);
  async function guarded(action: () => Promise<void>): Promise<void> {
    assertCurrent();
    if (current.current.isSaving) throw new Error("账本正在保存，请稍后重试。");
    if (lock.current === generation) return;
    lock.current = generation;
    setIsBusy(true);
    try {
      await action();
      setError("");
    } catch (cause) {
      if (isCurrent()) {
        setMessage("");
        if (cause instanceof CloudError && cause.status === CONFLICT_STATUS)
          conflict.current = true;
        setError(
          cause instanceof Error ? cause.message : "同步失败，请检查服务连接。",
        );
      }
      throw cause;
    } finally {
      if (lock.current === generation) lock.current = null;
      setIsBusy(false);
    }
  }
  async function sync(): Promise<void> {
    if (
      !isCurrent() ||
      current.current.network?.isConnected ||
      !user ||
      currentAuth.current.isOffline ||
      current.current.isLoading ||
      current.current.isSaving
    )
      return;
    await guarded(async () => {
      const original = current.current;
      const mode = original.mode;
      const userId = user.id;
      const raw = await protectedStore.getItem(linkKey(userId, mode));
      assertCurrent();
      if (!raw) {
        setIsLinked(false);
        return;
      }
      const link: Link = JSON.parse(raw);
      setIsLinked(true);
      const localFingerprint = await fingerprint({
        ledger: original.ledger,
        name: nameOf(original),
      });
      assertCurrent();
      const remote = await cloud.load(link.id, userId);
      assertCurrent();
      const latestFingerprint = await fingerprint({
        ledger: current.current.ledger,
        name: nameOf(current.current),
      });
      assertCurrent();
      if (
        latestFingerprint !== localFingerprint ||
        current.current.ledger !== original.ledger
      )
        return;
      const action = snapshotSyncAction(
        localFingerprint,
        remote.revision,
        link,
      );
      if (action === "conflict") {
        conflict.current = true;
        setPreview(remote);
        throw new CloudError(
          CONFLICT_STATUS,
          "本机和云端都发生了修改。两边数据已保留，请把云端版本恢复为新账本后整理。",
        );
      }
      let nextLink = link;
      if (action === "download") {
        assertCurrent();
        await current.current.commit(remote.ledger, { mode, assertCurrent });
        assertCurrent();
        if (nameOf(original) !== remote.name) {
          await current.current.updateBooks(
            original.books.map((book) =>
              book.id === mode ? { ...book, name: remote.name } : book,
            ),
          );
          assertCurrent();
        }
        const remoteFingerprint = await fingerprint({
          ledger: remote.ledger,
          name: remote.name,
        });
        assertCurrent();
        nextLink = {
          id: remote.id,
          revision: remote.revision,
          fingerprint: remoteFingerprint,
        };
        setMessage("已获取云端更新。");
      } else if (action === "upload") {
        assertCurrent();
        const saved = await cloud.save({
          userId,
          id: link.id,
          revision: link.revision,
          name: nameOf(original) ?? "账本",
          ledger: original.ledger,
        });
        assertCurrent();
        nextLink = {
          id: link.id,
          revision: saved.revision,
          fingerprint: localFingerprint,
        };
        setMessage("修改已同步到云端。");
      } else setMessage("当前账本已同步。");
      assertCurrent();
      await protectedStore.setItem(
        linkKey(userId, mode),
        JSON.stringify(nextLink),
      );
      assertCurrent();
      conflict.current = false;
      const refreshed = await cloud.books(userId);
      assertCurrent();
      setBooks(refreshed.books);
    });
  }
  useEffect(() => {
    let stopped = false;
    if (user)
      void protectedStore
        .getItem(linkKey(user.id, controller.mode))
        .then((raw) => {
          if (!stopped) setIsLinked(Boolean(raw));
        })
        .catch(() => {
          if (!stopped) setError("同步连接信息读取失败。");
        });
    return () => {
      stopped = true;
    };
  }, [contextKey, generation]);
  useEffect(() => {
    if (!user || controller.isLoading || !isLinked) return;
    const run = (): void => {
      if (!conflict.current && document.visibilityState === "visible")
        void sync().catch(() => undefined);
    };
    const timer = setInterval(run, SYNC_INTERVAL_MS);
    const debounce = setTimeout(run, SYNC_DEBOUNCE_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(debounce);
    };
  }, [
    contextKey,
    generation,
    controller.ledger,
    controller.books,
    controller.isLoading,
    isLinked,
  ]);
  async function upload(): Promise<void> {
    if (!user) return;
    await guarded(async () => {
      const original = current.current;
      assertCurrent();
      const saved = await cloud.save({
        userId: user.id,
        name: nameOf(original) ?? "账本",
        ledger: original.ledger,
      });
      assertCurrent();
      const value = await fingerprint({
        ledger: original.ledger,
        name: nameOf(original),
      });
      assertCurrent();
      await protectedStore.setItem(
        linkKey(user.id, original.mode),
        JSON.stringify({
          id: saved.id,
          revision: saved.revision,
          fingerprint: value,
        }),
      );
      assertCurrent();
      setIsLinked(true);
      const refreshed = await cloud.books(user.id);
      assertCurrent();
      setBooks(refreshed.books);
      setMessage("已创建云端副本，打开此账本时自动同步。");
      conflict.current = false;
    });
  }
  async function inspect(id: string): Promise<void> {
    if (!user) return;
    await guarded(async () => {
      const snapshot = await cloud.load(id, user.id);
      assertCurrent();
      setPreview(snapshot);
    });
  }
  async function restore(): Promise<void> {
    if (!preview || !user) return;
    await guarded(async () => {
      const value = await fingerprint({
        ledger: preview.ledger,
        name: preview.name,
      });
      assertCurrent();
      const prepare = Object.assign(
        async (): Promise<void> => {
          assertCurrent();
        },
        { assertCurrent },
      );
      const id = await controller.createBook(
        preview.name,
        preview.ledger,
        undefined,
        prepare,
      );
      function assertRestored(): void {
        if (
          !active.current ||
          account.current.key !== accountKey ||
          account.current.generation !== accountGeneration ||
          (current.current.mode !== controller.mode &&
            current.current.mode !== id) ||
          current.current.network?.isConnected ||
          current.current.isLoading
        )
          throw new Error("当前账本或登录状态已变化，请重新打开同步页面。");
      }
      assertRestored();
      try {
        await protectedStore.setItem(
          linkKey(user.id, id),
          JSON.stringify({
            id: preview.id,
            revision: preview.revision,
            fingerprint: value,
          }),
        );
      } catch {
        assertRestored();
        const message =
          "云端版本已恢复为新账本，但同步连接保存失败；请检查存储后重新连接。";
        controller.notify(message);
        throw new Error(message);
      }
      assertRestored();
      setState((previous) => {
        const currentContext = context.current;
        return previous.generation === currentContext.generation
          ? {
              ...previous,
              preview: null,
              isLinked: true,
              message: "已恢复为新账本并连接云端。",
            }
          : previous;
      });
      conflict.current = false;
    });
  }
  async function disconnect(): Promise<void> {
    if (!user) return;
    await guarded(async () => {
      assertCurrent();
      await protectedStore.setItem(linkKey(user.id, controller.mode), "");
      assertCurrent();
      setIsLinked(false);
      conflict.current = false;
      setMessage("已断开此账本同步，本机和云端数据均保留。");
    });
  }
  return {
    user,
    books,
    isBusy,
    message,
    error: error || auth.error,
    preview,
    isLinked,
    authenticate: auth.authenticate,
    logout: auth.logout,
    upload,
    sync,
    inspect,
    restore,
    disconnect,
    dismissPreview: () => setPreview(null),
  };
}
