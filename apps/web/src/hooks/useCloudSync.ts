import { useCloudBootstrap } from "./useCloudBootstrap";
const CONFLICT_STATUS = 409;
const SYNC_DEBOUNCE_MS = 1200;
import { useEffect, useRef, useState } from "react";
import {
  cloud,
  CloudError,
  type CloudBook,
  type CloudSnapshot,
  type CloudUser,
} from "../platform/browser/cloud";
import { protectedStore } from "../platform/browser/vault";
import type { LedgerController } from "./useLedger";
const SYNC_INTERVAL_MS = 15000;
import { fingerprint, linkKey, type Link } from "../platform/browser/sync-link";
import type { CloudController } from "./cloud-controller";
export type { CloudController } from "./cloud-controller";
export function useCloudSync(controller: LedgerController): CloudController {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [books, setBooks] = useState<CloudBook[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [preview, setPreview] = useState<CloudSnapshot | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const current = useRef(controller);
  current.current = controller;
  const currentUser = useRef(user);
  currentUser.current = user;
  const lock = useRef(false);
  const conflict = useRef(false);
  useCloudBootstrap({
    onUser: setUser,
    onBooks: setBooks,
    onError: setAuthError,
  });
  async function guarded(action: () => Promise<void>): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setIsBusy(true);
    try {
      await action();
      setError("");
    } catch (cause) {
      setMessage("");
      if (cause instanceof CloudError && cause.status === CONFLICT_STATUS)
        conflict.current = true;
      setError(
        cause instanceof Error ? cause.message : "同步失败，请检查服务连接。",
      );
      throw cause;
    } finally {
      lock.current = false;
      setIsBusy(false);
    }
  }
  async function sync(): Promise<void> {
    if (!user || current.current.isLoading || current.current.isSaving) return;
    await guarded(async () => {
      const original = current.current;
      const mode = original.mode;
      const userId = user.id;
      const raw = await protectedStore.getItem(linkKey(userId, mode));
      if (!raw) {
        setIsLinked(false);
        return;
      }
      const link: Link = JSON.parse(raw);
      setIsLinked(true);
      const localFingerprint = await fingerprint({
        ledger: original.ledger,
        name: original.books.find((book) => book.id === original.mode)?.name,
      });
      const remote = await cloud.load(link.id);
      if (
        currentUser.current?.id !== userId ||
        current.current.mode !== mode ||
        (await fingerprint({
          ledger: current.current.ledger,
          name: current.current.books.find((book) => book.id === mode)?.name,
        })) !== localFingerprint
      )
        return;
      if (
        current.current.ledger !== original.ledger ||
        current.current.mode !== mode
      )
        return;
      const hasLocalChange = localFingerprint !== link.fingerprint;
      const hasRemoteChange = remote.revision !== link.revision;
      if (hasLocalChange && hasRemoteChange) {
        conflict.current = true;
        setPreview(remote);
        throw new CloudError(
          CONFLICT_STATUS,
          "本机和云端都发生了修改。两边数据已保留，请把云端版本恢复为新账本后整理。",
        );
      }
      let nextLink = link;
      if (hasRemoteChange) {
        await current.current.commit(remote.ledger, mode);
        if (
          original.books.find((book) => book.id === mode)?.name !== remote.name
        )
          await current.current.updateBooks(
            original.books.map((book) =>
              book.id === mode ? { ...book, name: remote.name } : book,
            ),
          );
        nextLink = {
          id: remote.id,
          revision: remote.revision,
          fingerprint: await fingerprint({
            ledger: remote.ledger,
            name: remote.name,
          }),
        };
        setMessage("已获取云端更新。");
      } else if (hasLocalChange) {
        const saved = await cloud.save({
          id: link.id,
          revision: link.revision,
          name: original.books.find((book) => book.id === mode)?.name ?? "账本",
          ledger: original.ledger,
        });
        nextLink = {
          id: link.id,
          revision: saved.revision,
          fingerprint: localFingerprint,
        };
        setMessage("修改已同步到云端。");
      } else setMessage("当前账本已同步。");
      await protectedStore.setItem(
        linkKey(userId, mode),
        JSON.stringify(nextLink),
      );
      conflict.current = false;
      setBooks((await cloud.books()).books);
    });
  }
  useEffect(() => {
    conflict.current = false;
    setPreview(null);
    setIsLinked(false);
    setMessage("");
    if (!user) return;
    let stopped = false;
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
  }, [user, controller.mode]);
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
    user,
    controller.ledger,
    controller.books,
    controller.mode,
    controller.isLoading,
    isLinked,
  ]);
  async function authenticate(input: {
    username: string;
    password: string;
    isRegister: boolean;
  }): Promise<void> {
    await guarded(async () => {
      const result = await cloud.authenticate(input);
      setUser(result.user);
      setBooks((await cloud.books()).books);
      setMessage("已登录。选择要同步的账本。");
      conflict.current = false;
    });
  }
  async function logout(): Promise<void> {
    await guarded(async () => {
      await cloud.logout();
      setUser(null);
      setBooks([]);
      setPreview(null);
      setIsLinked(false);
      setMessage("已退出，账本仍保存在本机。");
    });
  }
  async function upload(): Promise<void> {
    if (!user) return;
    await guarded(async () => {
      const original = current.current;
      const saved = await cloud.save({
        name:
          original.books.find((book) => book.id === original.mode)?.name ??
          "账本",
        ledger: original.ledger,
      });
      await protectedStore.setItem(
        linkKey(user.id, original.mode),
        JSON.stringify({
          id: saved.id,
          revision: saved.revision,
          fingerprint: await fingerprint({
            ledger: original.ledger,
            name: original.books.find((book) => book.id === original.mode)
              ?.name,
          }),
        }),
      );
      if (current.current.mode === original.mode) setIsLinked(true);
      setBooks((await cloud.books()).books);
      setMessage("已创建云端副本，打开此账本时自动同步。");
      conflict.current = false;
    });
  }
  async function inspect(id: string): Promise<void> {
    await guarded(async () => setPreview(await cloud.load(id)));
  }
  async function restore(): Promise<void> {
    if (!preview || !user) return;
    await guarded(async () => {
      const id = await controller.createBook(preview.name, preview.ledger);
      await protectedStore.setItem(
        linkKey(user.id, id),
        JSON.stringify({
          id: preview.id,
          revision: preview.revision,
          fingerprint: await fingerprint({
            ledger: preview.ledger,
            name: preview.name,
          }),
        }),
      );
      setPreview(null);
      setIsLinked(true);
      conflict.current = false;
      setMessage("已恢复为新账本并连接云端。");
    });
  }
  async function disconnect(): Promise<void> {
    if (!user) return;
    await guarded(async () => {
      await protectedStore.setItem(linkKey(user.id, controller.mode), "");
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
    error: error || authError,
    preview,
    isLinked,
    authenticate,
    logout,
    upload,
    sync,
    inspect,
    restore,
    disconnect,
    dismissPreview: () => setPreview(null),
  };
}
