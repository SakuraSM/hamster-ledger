import { useEffect, useRef, useState } from "react";
import {
  EMPTY_LEDGER,
  ledgerPatch,
  migrateLedger,
  resolveReview,
  type Ledger,
  type LedgerMode,
  type LedgerRepository,
} from "@hamster-ledger/core";
import type { LedgerController } from "./useLedger.js";
import { editLedgerRecord } from "./ledger-actions.js";
import type { NetworkClient, NetworkSnapshot } from "./network-model.js";
const REFRESH_INTERVAL_MS = 15000;
export function useNetworkLedger(input: {
  local: LedgerController;
  client: NetworkClient;
  userId: string | null;
  server: string;
  repository: LedgerRepository;
  newId: () => string;
}): LedgerController {
  const { local, client, userId, server, repository, newId } = input;
  const cloud = local.books.find((item) => item.id === local.mode)?.cloud;
  const [remote, setRemote] = useState<NetworkSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isOnline, setOnline] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const cacheQueue = useRef<Promise<void>>(Promise.resolve());
  const [isRevoked, setRevoked] = useState(false);
  const latest = useRef(input);
  latest.current = input;
  const currentRemote = useRef(remote);
  currentRemote.current = remote;
  const contextKey = `${local.mode}:${cloud?.id ?? ""}:${userId ?? ""}:${server}`;
  const currentKey = useRef(contextKey);
  currentKey.current = contextKey;
  async function accept(snapshot: NetworkSnapshot, key: string): Promise<void> {
    const write = cacheQueue.current
      .catch(() => {})
      .then(async () => {
        if (currentKey.current !== key) return;
        if (
          currentRemote.current?.id === snapshot.id &&
          currentRemote.current.revision > snapshot.revision
        )
          return;
        const ledger = migrateLedger(snapshot.ledger);
        await repository.save(local.mode, ledger);
        if (currentKey.current !== key) return;
        const previous = currentRemote.current;
        currentRemote.current = {
          ...snapshot,
          ledger,
          operationId:
            snapshot.operationId ??
            (previous?.revision === snapshot.revision
              ? previous.operationId
              : undefined),
        };
        setRemote(currentRemote.current);
        setOnline(true);
        setRevoked(false);
        setError("");
      });
    cacheQueue.current = write;
    await write;
  }
  async function refresh(): Promise<void> {
    if (!cloud || busy.current) return;
    if (!userId || userId !== cloud.userId || server !== cloud.server) {
      setOnline(false);
      setError("请登录此联网账本对应的账号和服务。");
      return;
    }
    const key = contextKey;
    try {
      const snapshot = await client.request<NetworkSnapshot>(
        `/network/books/${cloud.id}`,
      );
      if (busy.current) return;
      await accept(snapshot, key);
    } catch (cause) {
      if (currentKey.current !== key) return;
      setOnline(false);
      if (
        cause &&
        typeof cause === "object" &&
        "status" in cause &&
        [401, 403, 404].includes(Number(cause.status))
      ) {
        setRevoked(true);
        setRemote(null);
        currentRemote.current = null;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "联网账本暂时不可用，当前只读。",
      );
    }
  }
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    setRemote(null);
    currentRemote.current = null;
    setOnline(false);
    setRevoked(false);
    setError("");
    if (!cloud) return;
    void refreshRef.current();
    const interval = setInterval(() => {
      void refreshRef.current();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [contextKey]);
  async function commit(
    next: Ledger,
    mode: LedgerMode = local.mode,
  ): Promise<void> {
    const selected = latest.current.local.books.find(
      (item) => item.id === mode,
    );
    if (!selected?.cloud) return latest.current.local.commit(next, mode);
    const snapshot = currentRemote.current;
    if (
      !isOnline ||
      !snapshot ||
      snapshot.id !== selected.cloud.id ||
      userId !== selected.cloud.userId ||
      server !== selected.cloud.server
    )
      throw new Error("联网账本当前只读，请连接正确账号后重试。");
    if (snapshot.role === "viewer") throw new Error("你在此账本中是只读成员。");
    if (busy.current) throw new Error("正在保存，请稍后。");
    busy.current = true;
    setBusy(true);
    const key = contextKey;
    try {
      const saved = await client.request<NetworkSnapshot>(
        `/network/books/${snapshot.id}/operations`,
        {
          method: "POST",
          body: {
            key: newId(),
            revision: snapshot.revision,
            patch: ledgerPatch(snapshot.ledger, next),
          },
        },
      );
      await accept(saved, key);
    } catch (cause) {
      if (currentKey.current !== key) throw cause;
      setError(
        cause instanceof Error ? cause.message : "保存失败，请刷新后重试。",
      );
      throw cause;
    } finally {
      busy.current = false;
      setBusy(false);
    }
  }
  function undo(): void {
    if (!cloud) return local.undo();
    const snapshot = currentRemote.current;
    if (!snapshot?.operationId || busy.current || !isOnline) return;
    busy.current = true;
    setBusy(true);
    void client
      .request<NetworkSnapshot>(`/network/books/${snapshot.id}/operations`, {
        method: "POST",
        body: {
          key: newId(),
          revision: snapshot.revision,
          undoId: snapshot.operationId,
        },
      })
      .then((saved) => accept(saved, contextKey))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "撤销失败。"),
      )
      .finally(() => {
        busy.current = false;
        setBusy(false);
      });
  }
  if (!cloud)
    return {
      ...local,
      network: { isConnected: false, isOnline: false, error: "", refresh },
    };
  const isIdentityValid = userId === cloud.userId && server === cloud.server;
  const ledger =
    !isIdentityValid || isRevoked
      ? EMPTY_LEDGER
      : remote?.id === cloud.id
        ? remote.ledger
        : local.ledger;
  return {
    ...local,
    ledger,
    isSaving: local.isSaving || isBusy,
    error: error || local.error,
    canUndo: Boolean(remote?.operationId && isOnline),
    commit,
    undo,
    editRecord: async (record) => commit(editLedgerRecord(ledger, record)),
    decide: (review, decision) => {
      void commit(resolveReview({ ledger, review, decision })).catch(
        (cause: unknown) =>
          setError(cause instanceof Error ? cause.message : "核对失败。"),
      );
    },
    network: {
      isConnected: true,
      isOnline,
      role: remote?.role ?? cloud.role,
      revision: remote?.revision,
      error,
      refresh,
    },
  };
}
