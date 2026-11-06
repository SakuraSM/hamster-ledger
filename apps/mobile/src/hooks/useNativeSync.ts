import type { NativeSyncController, SyncLink } from "./native-sync-controller";
export type { NativeSyncController } from "./native-sync-controller";
import { useForegroundSync } from "./useForegroundSync";
import { snapshotSyncAction } from "@hamster-ledger/core";
const CONFLICT_STATUS = 409;
import { useEffect, useRef, useState } from "react";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { serializeSnapshot } from "../platform/snapshot";
import { nativeStore } from "../platform/storage";
import { useNativeAccount } from "../auth/NativeAccount";
import {
  CloudError,
  type CloudBook,
  type CloudSnapshot,
} from "../platform/cloud-client";
const fingerprint = (value: unknown): Promise<string> =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, serializeSnapshot(value));
interface SyncState {
  generation: number;
  link: SyncLink | null;
  books: CloudBook[];
  preview: CloudSnapshot | null;
  isBusy: boolean;
  error: string;
  message: string;
}
function emptyState(generation: number): SyncState {
  return {
    generation,
    link: null,
    books: [],
    preview: null,
    isBusy: false,
    error: "",
    message: "",
  };
}
export function useNativeSync(
  controller: LedgerController,
): NativeSyncController {
  const account = useNativeAccount();
  const userId = account.credentials?.user.id ?? "";
  const session = account.credentials?.session.id;
  const identity = account.server + ":" + userId;
  const linkKey = "hamster.native.sync." + identity + ":" + controller.mode;
  const cloud = controller.books.find(
    (book) => book.id === controller.mode,
  )?.cloud;
  const accountKey = JSON.stringify([account.server, userId, session ?? null]);
  const contextKey = JSON.stringify([
    accountKey,
    controller.mode,
    cloud?.id ?? null,
    cloud?.userId ?? null,
    cloud?.server ?? null,
  ]);
  const context = useRef({ key: contextKey, generation: 0 });
  const accountContext = useRef({ key: accountKey, generation: 0 });
  if (context.current.key !== contextKey)
    context.current = {
      key: contextKey,
      generation: context.current.generation + 1,
    };
  if (accountContext.current.key !== accountKey)
    accountContext.current = {
      key: accountKey,
      generation: accountContext.current.generation + 1,
    };
  const generation = context.current.generation;
  const accountGeneration = accountContext.current.generation;
  const [state, setState] = useState<SyncState>(() => emptyState(generation));
  if (state.generation !== generation) setState(emptyState(generation));
  const visible =
    state.generation === generation ? state : emptyState(generation);
  const { link, books, preview, isBusy, error, message } = visible;
  const current = useRef({ controller, account });
  current.current = { controller, account };
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
      !current.current.account.credentials ||
      current.current.account.credentials.user.mustChangePassword ||
      current.current.controller.isLoading ||
      current.current.controller.network?.isConnected
    )
      throw new Error("当前账本或登录状态已变化，请重新打开同步页面。");
  }
  function patch(value: Partial<SyncState>): void {
    if (!isCurrent()) return;
    setState((previous) =>
      previous.generation === generation ? { ...previous, ...value } : previous,
    );
  }
  const setLink = (value: SyncLink | null): void => patch({ link: value });
  const setBooks = (value: CloudBook[]): void => patch({ books: value });
  const setPreview = (value: CloudSnapshot | null): void =>
    patch({ preview: value });
  const setBusy = (value: boolean): void => patch({ isBusy: value });
  const setError = (value: string): void => patch({ error: value });
  const setMessage = (value: string): void => patch({ message: value });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (account.credentials && !account.credentials.user.mustChangePassword)
      void (async () => {
        const raw = await nativeStore.getItem(linkKey);
        if (cancelled || !isCurrent()) return;
        setLink(raw ? (JSON.parse(raw) as SyncLink) : null);
        const result = await account.client.books();
        if (!cancelled) setBooks(result.books);
      })().catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "读取同步信息失败。",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [contextKey, generation]);
  const name = (value: LedgerController): string =>
    value.books.find((book) => book.id === value.mode)?.name ?? "账本";
  async function run(action: () => Promise<void>): Promise<void> {
    if (
      !isCurrent() ||
      !account.credentials ||
      account.credentials.user.mustChangePassword
    )
      return;
    if (current.current.controller.network?.isConnected) {
      setError("联网账本使用在线编辑，无需整本同步。");
      return;
    }
    if (
      lock.current === generation ||
      current.current.controller.isLoading ||
      current.current.controller.isSaving
    )
      return;
    lock.current = generation;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      if (isCurrent())
        setError(
          cause instanceof Error ? cause.message : "同步失败，本机账本已保留。",
        );
    } finally {
      if (lock.current === generation) lock.current = null;
      setBusy(false);
    }
  }
  async function saveLink(value: SyncLink): Promise<void> {
    assertCurrent();
    await nativeStore.setItem(linkKey, JSON.stringify(value));
    assertCurrent();
    setLink(value);
  }
  async function upload(): Promise<void> {
    await run(async () => {
      const original = controller;
      assertCurrent();
      const saved = await account.client.save({
        name: name(original),
        ledger: original.ledger,
      });
      assertCurrent();
      const hash = await fingerprint({
        name: name(original),
        ledger: original.ledger,
      });
      assertCurrent();
      await saveLink({
        id: saved.id,
        revision: saved.revision,
        fingerprint: hash,
      });
      const refreshed = await account.client.books();
      assertCurrent();
      setBooks(refreshed.books);
      setMessage("已上传并建立连接。应用在前台时自动同步。");
    });
  }
  async function sync(): Promise<void> {
    if (!link) return;
    await run(async () => {
      const original = controller;
      const hash = await fingerprint({
        name: name(original),
        ledger: original.ledger,
      });
      assertCurrent();
      const remote = await account.client.load(link.id);
      assertCurrent();
      const latest = current.current.controller;
      if (
        latest.isLoading ||
        latest.isSaving ||
        latest.ledger !== original.ledger ||
        name(latest) !== name(original)
      )
        return;
      const action = snapshotSyncAction(hash, remote.revision, link);
      if (action === "conflict") {
        conflict.current = true;
        setPreview(remote);
        throw new CloudError(CONFLICT_STATUS, {
          message:
            "本机和云端均已修改，两边数据已保留。请把云端版本恢复为新账本后核对。",
        });
      }
      if (action === "download") {
        const remoteHash = await fingerprint({
          name: remote.name,
          ledger: remote.ledger,
        });
        assertCurrent();
        const beforeCommit = current.current.controller;
        if (
          beforeCommit.isSaving ||
          beforeCommit.ledger !== original.ledger ||
          name(beforeCommit) !== name(original)
        )
          return;
        await beforeCommit.commit(remote.ledger, {
          mode: original.mode,
          assertCurrent,
        });
        assertCurrent();
        if (name(original) !== remote.name) {
          await current.current.controller.updateBooks(
            current.current.controller.books.map((book) =>
              book.id === original.mode ? { ...book, name: remote.name } : book,
            ),
          );
          assertCurrent();
        }
        await saveLink({
          id: remote.id,
          revision: remote.revision,
          fingerprint: remoteHash,
        });
        conflict.current = false;
        setMessage("已获取云端更新。");
        return;
      }
      if (action === "idle") {
        conflict.current = false;
        setMessage("当前账本已同步。");
        return;
      }
      try {
        assertCurrent();
        const saved = await account.client.save({
          id: link.id,
          revision: link.revision,
          name: name(original),
          ledger: original.ledger,
        });
        assertCurrent();
        await saveLink({
          id: link.id,
          revision: saved.revision,
          fingerprint: hash,
        });
        const refreshed = await account.client.books();
        assertCurrent();
        setBooks(refreshed.books);
        conflict.current = false;
        setMessage("本机修改已同步。");
      } catch (cause) {
        if (
          cause instanceof CloudError &&
          cause.status === CONFLICT_STATUS &&
          isCurrent()
        ) {
          const latest = await account.client.load(link.id);
          assertCurrent();
          conflict.current = true;
          setPreview(latest);
        }
        throw cause;
      }
    });
  }
  useForegroundSync({
    sync,
    controller,
    enabled: Boolean(
      link &&
      account.credentials &&
      !controller.network?.isConnected &&
      !controller.isLoading,
    ),
    conflict,
  });
  const refresh = (): Promise<void> =>
    run(async () => {
      const result = await account.client.books();
      assertCurrent();
      setBooks(result.books);
    });
  const inspect = (id: string): Promise<void> =>
    run(async () => {
      const value = await account.client.load(id);
      assertCurrent();
      setPreview(value);
    });
  const restore = (): Promise<void> =>
    run(async () => {
      if (!preview) return;
      const hash = await fingerprint({
        name: preview.name,
        ledger: preview.ledger,
      });
      assertCurrent();
      const prepare = Object.assign(
        async (): Promise<void> => {
          assertCurrent();
        },
        { assertCurrent },
      );
      const mode = await controller.createBook(
        preview.name,
        preview.ledger,
        undefined,
        prepare,
      );
      function assertRestored(): void {
        if (
          !active.current ||
          accountContext.current.key !== accountKey ||
          accountContext.current.generation !== accountGeneration ||
          (current.current.controller.mode !== controller.mode &&
            current.current.controller.mode !== mode) ||
          current.current.controller.network?.isConnected ||
          current.current.controller.isLoading
        )
          throw new Error("当前账本或登录状态已变化，请重新打开同步页面。");
      }
      assertRestored();
      const next = {
        id: preview.id,
        revision: preview.revision,
        fingerprint: hash,
      };
      try {
        await nativeStore.setItem(
          "hamster.native.sync." + identity + ":" + mode,
          JSON.stringify(next),
        );
      } catch {
        assertRestored();
        const message =
          "云端版本已恢复为新账本，但同步连接保存失败；请检查存储后重新连接。";
        controller.notify(message);
        throw new Error(message);
      }
      assertRestored();
      if (current.current.controller.mode === mode)
        setState((previous) =>
          previous.generation === context.current.generation
            ? { ...previous, link: next, preview: null }
            : previous,
        );
      controller.notify("云端版本已恢复为新账本，原账本保留。");
    });
  const disconnect = (): Promise<void> =>
    run(async () => {
      assertCurrent();
      await nativeStore.setItem(linkKey, "");
      assertCurrent();
      conflict.current = false;
      setLink(null);
      setPreview(null);
      setMessage("已断开连接，本机和云端数据均保留。");
    });
  return {
    link,
    books,
    preview,
    isBusy,
    error,
    message,
    upload,
    sync,
    refresh,
    inspect,
    restore,
    disconnect,
    dismissPreview: () => setPreview(null),
  };
}
