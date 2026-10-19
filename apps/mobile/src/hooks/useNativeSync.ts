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
export function useNativeSync(
  controller: LedgerController,
): NativeSyncController {
  const account = useNativeAccount();
  const identity = account.server + ":" + (account.credentials?.user.id ?? "");
  const linkKey = "hamster.native.sync." + identity + ":" + controller.mode;
  const [link, setLink] = useState<SyncLink | null>(null);
  const [books, setBooks] = useState<CloudBook[]>([]);
  const [preview, setPreview] = useState<CloudSnapshot | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const session = account.credentials?.session.id;
  const current = useRef({ controller, identity, session });
  current.current = { controller, identity, session };
  const lock = useRef(false);
  const conflict = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    conflict.current = false;
    setLink(null);
    setBooks([]);
    setPreview(null);
    setError("");
    setMessage("");
    if (account.credentials && !account.credentials.user.mustChangePassword)
      void (async () => {
        const raw = await nativeStore.getItem(linkKey);
        if (!cancelled) setLink(raw ? (JSON.parse(raw) as SyncLink) : null);
        const result = await account.client.books();
        if (!cancelled) setBooks(result.books);
      })().catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "读取同步信息失败。",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [linkKey, account.credentials?.session.id]);
  const name = (value: LedgerController): string =>
    value.books.find((book) => book.id === value.mode)?.name ?? "账本";
  function assertCurrent(): void {
    if (
      !active.current ||
      current.current.identity !== identity ||
      current.current.session !== session ||
      current.current.controller.mode !== controller.mode
    )
      throw new Error("当前账本或登录状态已变化，请重新打开同步页面。");
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (!account.credentials || account.credentials.user.mustChangePassword)
      return;
    if (controller.network?.isConnected) {
      setError("联网账本使用在线编辑，无需整本同步。");
      return;
    }
    if (lock.current || controller.isLoading || controller.isSaving) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      if (
        active.current &&
        current.current.identity === identity &&
        current.current.session === session
      )
        setError(
          cause instanceof Error ? cause.message : "同步失败，本机账本已保留。",
        );
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
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
      const saved = await account.client.save({
        name: name(original),
        ledger: original.ledger,
      });
      await saveLink({
        id: saved.id,
        revision: saved.revision,
        fingerprint: await fingerprint({
          name: name(original),
          ledger: original.ledger,
        }),
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
        await beforeCommit.commit(remote.ledger, original.mode);
        assertCurrent();
        if (name(original) !== remote.name)
          await current.current.controller.updateBooks(
            current.current.controller.books.map((book) =>
              book.id === original.mode ? { ...book, name: remote.name } : book,
            ),
          );
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
        const saved = await account.client.save({
          id: link.id,
          revision: link.revision,
          name: name(original),
          ledger: original.ledger,
        });
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
        if (cause instanceof CloudError && cause.status === CONFLICT_STATUS) {
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
      link && account.credentials && !controller.network?.isConnected,
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
      assertCurrent();
      const hash = await fingerprint({
        name: preview.name,
        ledger: preview.ledger,
      });
      const mode = await controller.createBook(preview.name, preview.ledger);
      await nativeStore.setItem(
        "hamster.native.sync." + identity + ":" + mode,
        JSON.stringify({
          id: preview.id,
          revision: preview.revision,
          fingerprint: hash,
        }),
      );
      controller.notify("云端版本已恢复为新账本，原账本保留。");
    });
  const disconnect = (): Promise<void> =>
    run(async () => {
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
