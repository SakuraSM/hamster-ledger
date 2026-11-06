import { useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_LEDGER,
  ledgerPatch,
  migrateLedger,
  resolveReview,
  type Ledger,
  type LedgerMode,
  type Book,
  type LedgerRepository,
  type NetworkCacheIdentity,
  type NetworkCacheEntry,
} from "@hamster-ledger/core";
import type { LedgerController } from "./useLedger.js";
import { editLedgerRecord } from "./ledger-actions.js";
import { queueLedgerWrite } from "./ledger-write-queue.js";
import {
  canViewBook,
  directoryFingerprint,
  mergeVisibleBooks,
} from "./network-directory.js";
import * as networkGuards from "./network-write-guards.js";
import type {
  NetworkClient,
  NetworkSnapshot,
  ScopedNetworkSnapshot,
  ScopedNetworkCache,
} from "./network-model.js";
const REFRESH_INTERVAL_MS = 15000;
export function useNetworkLedger(input: {
  local: LedgerController;
  client: NetworkClient;
  userId: string | null;
  server: string;
  identityLoading?: boolean;
  repository: LedgerRepository;
  newId: () => string;
}): LedgerController {
  const { local, client, userId, server, repository, newId } = input;
  const identityLoading = input.identityLoading ?? false;
  const networkContext = networkGuards.networkContext(input);
  const { cloud } = networkContext;
  const contextKey = JSON.stringify([
    networkContext.contextKey,
    identityLoading,
  ]);
  const directoryIdentity = useMemo(
    () => ({ userId, server, isLoading: identityLoading }),
    [userId, server, identityLoading],
  );
  const visibleBooks = useMemo(
    () => local.books.filter((book) => canViewBook(book, directoryIdentity)),
    [local.books, directoryIdentity],
  );
  const currentBook = local.books.find((book) => book.id === local.mode);
  const hiddenActive = Boolean(
    currentBook?.cloud && !canViewBook(currentBook, directoryIdentity),
  );
  const fallback =
    visibleBooks.find(
      (book) => book.id === "personal" && !book.cloud && !book.isArchived,
    )?.id ??
    visibleBooks.find(
      (book) => book.id === "demo" && !book.cloud && !book.isArchived,
    )?.id ??
    visibleBooks.find((book) => !book.cloud && !book.isArchived)?.id;
  const [remoteState, setRemote] = useState<ScopedNetworkSnapshot | null>(null);
  const [cacheState, setCache] = useState<ScopedNetworkCache | null>(null);
  const [error, setError] = useState("");
  const [isOnline, setOnline] = useState(false);
  const currentOnline = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);
  const requestSequence = useRef(0);
  const settledSequence = useRef(0);
  const [isRevoked, setRevoked] = useState(false);
  const latest = useRef(input);
  latest.current = input;
  const currentRemote = useRef<ScopedNetworkSnapshot | null>(null);
  const authorizationEpoch = useRef(0);
  const contextVersion = useRef({ key: contextKey, value: 0 });
  if (contextVersion.current.key !== contextKey) {
    contextVersion.current.key = contextKey;
    contextVersion.current.value += 1;
  }
  const capturedContextVersion = contextVersion.current.value;
  const contextSession = useRef({
    key: contextKey,
    version: capturedContextVersion,
    token: {},
  });
  if (
    contextSession.current.key !== contextKey ||
    contextSession.current.version !== capturedContextVersion
  )
    contextSession.current = {
      key: contextKey,
      version: capturedContextVersion,
      token: {},
    };
  const contextToken = contextSession.current.token;
  const authorizationBlocked = useRef({
    key: contextKey,
    version: capturedContextVersion,
    blocked: false,
  });
  if (
    authorizationBlocked.current.key !== contextKey ||
    authorizationBlocked.current.version !== capturedContextVersion
  )
    authorizationBlocked.current = {
      key: contextKey,
      version: capturedContextVersion,
      blocked: false,
    };
  const capturedAuthorizationEpoch = authorizationEpoch.current;
  const session = useRef({
    key: contextKey,
    version: capturedContextVersion,
    epoch: capturedAuthorizationEpoch,
    token: {},
  });
  if (
    session.current.key !== contextKey ||
    session.current.version !== capturedContextVersion ||
    session.current.epoch !== capturedAuthorizationEpoch
  )
    session.current = {
      key: contextKey,
      version: capturedContextVersion,
      epoch: capturedAuthorizationEpoch,
      token: {},
    };
  const sessionToken = session.current.token;
  const remote =
    remoteState?.key === contextKey &&
    remoteState.version === capturedContextVersion
      ? remoteState.snapshot
      : null;
  const cache =
    cacheState?.key === contextKey &&
    cacheState.version === capturedContextVersion
      ? cacheState.entry
      : null;
  const identity: NetworkCacheIdentity | null = cloud
    ? {
        mode: local.mode,
        id: cloud.id,
        userId: cloud.userId,
        server: cloud.server,
      }
    : null;
  const canPersistCache = Boolean(
    repository.loadNetworkCache && repository.saveNetworkCache,
  );
  const cacheRead = useRef({
    key: contextKey,
    version: capturedContextVersion,
    ready: !canPersistCache,
  });
  if (
    cacheRead.current.key !== contextKey ||
    cacheRead.current.version !== capturedContextVersion
  )
    cacheRead.current = {
      key: contextKey,
      version: capturedContextVersion,
      ready: !canPersistCache,
    };
  const observedRevision = useRef({
    key: contextKey,
    version: capturedContextVersion,
    value: -1,
  });
  if (
    observedRevision.current.key !== contextKey ||
    observedRevision.current.version !== capturedContextVersion
  )
    observedRevision.current = {
      key: contextKey,
      version: capturedContextVersion,
      value: -1,
    };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      !identityLoading &&
      !local.isLoading &&
      !local.isSaving &&
      hiddenActive &&
      fallback &&
      local.mode !== fallback
    )
      local.switchMode(fallback as LedgerMode);
  }, [
    identityLoading,
    local.isLoading,
    local.isSaving,
    local.mode,
    local.switchMode,
    hiddenActive,
    fallback,
  ]);
  function isCurrentContext(): boolean {
    return (
      mounted.current &&
      contextVersion.current.key === contextKey &&
      contextVersion.current.value === capturedContextVersion
    );
  }
  function assertUsable(): void {
    if (
      identityLoading ||
      latest.current.identityLoading ||
      local.isLoading ||
      latest.current.local.isLoading ||
      hiddenActive ||
      !isCurrentContext()
    )
      throw new Error("账本或登录身份正在加载或已变化，请重新打开后重试。");
  }
  function switchMode(mode: LedgerMode): void {
    try {
      assertUsable();
    } catch {
      return;
    }
    const target = latest.current.local.books.find((book) => book.id === mode);
    if (!target || target.isArchived || !canViewBook(target, directoryIdentity))
      return;
    local.switchMode(mode);
  }
  async function updateBooks(books: Book[]): Promise<void> {
    assertUsable();
    if (latest.current.local.books !== local.books)
      throw new Error("账本目录已变化，请重新打开后重试。");
    const persisted = await repository.listBooks();
    assertUsable();
    if (
      latest.current.local.books !== local.books ||
      directoryFingerprint(
        persisted.filter((book) => canViewBook(book, directoryIdentity)),
      ) !== directoryFingerprint(visibleBooks)
    )
      throw new Error("账本目录已变化，请重新打开后重试。");
    return local.updateBooks(
      mergeVisibleBooks({
        current: persisted,
        proposed: books,
        identity: directoryIdentity,
      }),
      {
        expectedBooks: persisted,
        assertCurrent: () => {
          assertUsable();
          if (latest.current.local.books !== local.books)
            throw new Error("账本目录已变化，请重新打开后重试。");
        },
      },
    );
  }
  const createBook: LedgerController["createBook"] = async (
    name,
    initial,
    target,
    prepare,
  ) => {
    assertUsable();
    if (
      target &&
      (!userId || target.userId !== userId || target.server !== server)
    )
      throw new Error("联网账本身份不匹配。");
    const ensureCurrent = (): void => {
      assertUsable();
      prepare?.assertCurrent?.();
    };
    const guarded = Object.assign(
      async (mode: LedgerMode): Promise<void> => {
        ensureCurrent();
        await prepare?.(mode);
        ensureCurrent();
      },
      { assertCurrent: ensureCurrent },
    );
    return local.createBook(name, initial, target, guarded);
  };
  function currentSnapshot(): NetworkSnapshot | null {
    const value = currentRemote.current;
    return value?.key === contextKey && value.version === capturedContextVersion
      ? value.snapshot
      : null;
  }
  function observe(snapshot: NetworkSnapshot): boolean {
    if (!isCurrentContext()) return false;
    if (!cloud || snapshot.id !== cloud.id)
      throw new Error("联网账本身份不匹配。");
    if (snapshot.revision < observedRevision.current.value) return false;
    observedRevision.current.value = snapshot.revision;
    return true;
  }
  function markSettled(sequence: number): boolean {
    if (sequence < settledSequence.current) return false;
    settledSequence.current = sequence;
    return true;
  }
  async function accept({
    snapshot,
    isCurrentRequest,
    source,
  }: {
    snapshot: NetworkSnapshot;
    isCurrentRequest: () => boolean;
    source: "refresh" | "server-write";
  }): Promise<void> {
    await queueLedgerWrite({
      repository,
      mode: local.mode,
      write: async () => {
        if (!isCurrentContext() || !isCurrentRequest()) return;
        if (snapshot.revision < observedRevision.current.value) return;
        const ledger = migrateLedger(snapshot.ledger);
        let cacheWriteFailed = false;
        if (canPersistCache && identity && repository.saveNetworkCache) {
          try {
            await repository.saveNetworkCache(identity, {
              status: "verified",
              revision: snapshot.revision,
              ledger,
            });
          } catch (cause) {
            if (!isCurrentContext() || !isCurrentRequest()) return;
            let existing: NetworkCacheEntry | null = null;
            try {
              existing = await repository.loadNetworkCache!(identity);
            } catch {
              const message =
                source === "server-write"
                  ? "服务器已保存，但无法核验本机缓存状态，请重新联网核对。"
                  : "无法读取联网缓存状态，请检查存储后重试。";
              invalidateCurrent(message);
              throw new Error(message);
            }
            if (!isCurrentContext() || !isCurrentRequest()) return;
            const isConflict = Boolean(
              cause &&
              typeof cause === "object" &&
              "code" in cause &&
              cause.code === "LEDGER_STORAGE_CONFLICT",
            );
            if (
              isConflict ||
              existing?.status !== "verified" ||
              (existing.revision ?? -1) > snapshot.revision
            ) {
              const message =
                source === "server-write"
                  ? "服务器已保存，但联网缓存状态已变化，请重新解锁并联网核对。"
                  : "联网缓存状态已变化，请重新解锁并联网核对。";
              invalidateCurrent(message);
              throw new Error(message);
            }
            if (source === "refresh") throw cause;
            cacheWriteFailed = true;
          }
        }
        if (
          !isCurrentContext() ||
          !isCurrentRequest() ||
          snapshot.revision < observedRevision.current.value
        )
          return;
        if (
          authorizationBlocked.current.key === contextKey &&
          authorizationBlocked.current.version === capturedContextVersion &&
          authorizationBlocked.current.blocked
        ) {
          authorizationEpoch.current += 1;
          authorizationBlocked.current.blocked = false;
        }
        const previous = currentSnapshot();
        const next = {
          ...snapshot,
          ledger,
          operationId:
            snapshot.operationId ??
            (previous?.revision === snapshot.revision
              ? previous.operationId
              : undefined),
        };
        currentRemote.current = {
          key: contextKey,
          version: capturedContextVersion,
          snapshot: next,
        };
        setRemote(currentRemote.current);
        setCache(null);
        currentOnline.current = true;
        setOnline(true);
        setRevoked(false);
        setError(
          cacheWriteFailed
            ? "服务器已保存，但离线缓存未更新，请检查本机存储。"
            : "",
        );
      },
    });
  }
  function invalidateCurrent(reason: string): void {
    if (!isCurrentContext()) return;
    markSettled(++requestSequence.current);
    authorizationEpoch.current += 1;
    authorizationBlocked.current = {
      key: contextKey,
      version: capturedContextVersion,
      blocked: true,
    };
    observedRevision.current.value = -1;
    currentOnline.current = false;
    setOnline(false);
    setRevoked(true);
    setRemote(null);
    setCache(null);
    currentRemote.current = null;
    setError(reason);
  }
  async function revokeCache(
    reason: string,
    revalidateOtherSessions = false,
  ): Promise<void> {
    if (!identity) throw new Error("联网账本身份不可用。");
    const previous = currentSnapshot();
    const sessions = networkGuards.networkSessions(repository, contextKey);
    if (
      !sessions.some((item) => item.token === sessionToken) &&
      isCurrentContext()
    )
      invalidateCurrent(reason);
    for (const item of sessions) item.invalidate(reason);
    try {
      if (
        canPersistCache &&
        repository.loadNetworkCache &&
        repository.saveNetworkCache
      ) {
        await queueLedgerWrite({
          repository,
          mode: local.mode,
          write: async () => {
            const existing = await repository.loadNetworkCache!(identity);
            await repository.saveNetworkCache!(identity, {
              ...existing,
              ...(existing
                ? {}
                : previous
                  ? { revision: previous.revision, ledger: previous.ledger }
                  : {}),
              status: "revoked",
            });
          },
        });
      }
    } catch {
      const message =
        "权限已撤销，但本机撤权状态保存失败；重启离线时缓存可能仍可见。";
      for (const item of sessions) item.reportFailure(message);
      if (isCurrentContext()) setError(message);
      throw new Error(message);
    }
    if (revalidateOtherSessions)
      await Promise.all(
        sessions
          .filter((item) => item.token !== sessionToken)
          .map((item) => item.revalidate()),
      );
  }
  async function prepareCache({
    mode,
    snapshot,
  }: {
    mode: LedgerMode;
    snapshot: NetworkSnapshot;
  }): Promise<void> {
    function ensureCurrent(): void {
      if (
        !isCurrentContext() ||
        capturedAuthorizationEpoch !== authorizationEpoch.current ||
        !userId
      )
        throw Object.assign(
          new Error("账本或登录身份已变化，请重新打开联网账本。"),
          { code: "NETWORK_CONTEXT_CHANGED" },
        );
    }
    ensureCurrent();
    if (!userId) throw new Error("请先登录。");
    if (!repository.loadNetworkCache || !repository.saveNetworkCache)
      throw new Error("本机仓储不支持联网离线缓存。");
    const target = { mode, id: snapshot.id, userId, server };
    await queueLedgerWrite({
      repository,
      mode,
      write: async () => {
        ensureCurrent();
        const existing = await repository.loadNetworkCache!(target);
        ensureCurrent();
        if (existing?.status === "revoked")
          throw Object.assign(new Error("联网缓存已撤权，请重新联网核对。"), {
            code: "NETWORK_CACHE_REVOKED",
          });
        if ((existing?.revision ?? -1) > snapshot.revision)
          throw Object.assign(new Error("联网账本已更新，请重新打开。"), {
            code: "LEDGER_STORAGE_CONFLICT",
          });
        await repository.saveNetworkCache!(target, {
          status: "verified",
          revision: snapshot.revision,
          ledger: migrateLedger(snapshot.ledger),
        });
        ensureCurrent();
      },
    });
  }
  async function refresh(): Promise<void> {
    if (
      !cloud ||
      identityLoading ||
      hiddenActive ||
      busy.current ||
      !isCurrentContext()
    )
      return;
    const sequence = ++requestSequence.current;
    const isCurrentRequest = (): boolean =>
      sequence === settledSequence.current;
    if (!userId || userId !== cloud.userId || server !== cloud.server) {
      markSettled(sequence);
      currentOnline.current = false;
      setOnline(false);
      setError("请登录此联网账本对应的账号和服务。");
      return;
    }
    if (!cacheRead.current.ready && identity && repository.loadNetworkCache) {
      const readEpoch = authorizationEpoch.current;
      try {
        const loaded: { entry: NetworkCacheEntry | null } = { entry: null };
        await queueLedgerWrite({
          repository,
          mode: local.mode,
          write: async () => {
            if (
              !isCurrentContext() ||
              sequence < settledSequence.current ||
              readEpoch !== authorizationEpoch.current
            )
              return;
            loaded.entry = await repository.loadNetworkCache!(identity);
          },
        });
        if (
          !isCurrentContext() ||
          sequence < settledSequence.current ||
          readEpoch !== authorizationEpoch.current
        )
          return;
        const { entry } = loaded;
        cacheRead.current.ready = true;
        if (entry?.status === "revoked") {
          authorizationBlocked.current.blocked = true;
          setRevoked(true);
        } else if (entry?.status === "verified") {
          setCache({ key: contextKey, version: capturedContextVersion, entry });
          if (entry.revision !== undefined)
            observedRevision.current.value = Math.max(
              observedRevision.current.value,
              entry.revision,
            );
        }
      } catch {
        if (isCurrentContext() && markSettled(sequence)) {
          currentOnline.current = false;
          setOnline(false);
          setRevoked(true);
          setError("无法读取联网缓存状态，请检查存储后重试。");
        }
        return;
      }
    }
    try {
      const snapshot = await client.request<NetworkSnapshot>(
        `/network/books/${cloud.id}`,
      );
      if (
        busy.current ||
        !isCurrentContext() ||
        sequence < settledSequence.current ||
        !observe(snapshot) ||
        !markSettled(sequence)
      )
        return;
      await accept({ snapshot, isCurrentRequest, source: "refresh" });
    } catch (cause) {
      if (!isCurrentContext() || !markSettled(sequence)) return;
      currentOnline.current = false;
      setOnline(false);
      if (networkGuards.isRevokedStatus(cause)) {
        try {
          await revokeCache(
            cause instanceof Error ? cause.message : "联网账本权限已撤销。",
          );
        } catch {
          // The current session stays revoked; revokeCache reports persistence failure.
        }
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "联网账本暂时不可用，当前只读。",
        );
      }
    }
  }
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!cloud || identityLoading || hiddenActive) return;
    return networkGuards.registerNetworkSession({
      repository,
      key: contextKey,
      session: {
        token: sessionToken,
        invalidate: invalidateCurrent,
        reportFailure: (message) => {
          if (isCurrentContext()) setError(message);
        },
        revalidate: async () => {
          if (isCurrentContext()) await refreshRef.current();
        },
      },
    });
  }, [contextKey, repository, sessionToken, identityLoading, hiddenActive]);
  useEffect(() => {
    setRemote(null);
    setCache(null);
    currentRemote.current = null;
    currentOnline.current = false;
    setOnline(false);
    setRevoked(false);
    setError("");
    if (!cloud || identityLoading || hiddenActive) return;
    void refreshRef.current();
    const interval = setInterval(() => {
      void refreshRef.current();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [contextKey, identityLoading, hiddenActive]);
  async function commit(
    next: Ledger,
    modeOrOptions?: Parameters<LedgerController["commit"]>[1],
  ): Promise<void> {
    assertUsable();
    const externalGuard =
      typeof modeOrOptions === "object"
        ? modeOrOptions?.assertCurrent
        : undefined;
    const assertCurrent = (): void => {
      assertUsable();
      externalGuard?.();
    };
    assertCurrent();
    const checked = networkGuards.guardNetworkCommit({
      modeOrOptions,
      capturedMode: local.mode,
      books: latest.current.local.books,
      isCurrentContext: isCurrentContext(),
      isOnline: isOnline && currentOnline.current,
      snapshot: currentSnapshot(),
      rendered: remote,
      userId,
      server,
      isBusy: busy.current,
    });
    if (!checked.snapshot)
      return latest.current.local.commit(next, {
        mode: checked.mode,
        assertCurrent,
      });
    const { snapshot } = checked;
    busy.current = true;
    setBusy(true);
    const sequence = ++requestSequence.current;
    markSettled(sequence);
    const isCurrentRequest = (): boolean =>
      sequence === settledSequence.current;
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
      if (observe(saved))
        await accept({
          snapshot: saved,
          isCurrentRequest,
          source: "server-write",
        });
    } catch (cause) {
      if (!isCurrentContext() || !isCurrentRequest()) throw cause;
      if (networkGuards.isRevokedStatus(cause)) {
        await revokeCache(
          cause instanceof Error ? cause.message : "联网账本权限已撤销。",
        );
      } else {
        setError(
          cause instanceof Error ? cause.message : "保存失败，请刷新后重试。",
        );
      }
      throw cause;
    } finally {
      busy.current = false;
      setBusy(false);
    }
  }
  function undo(): void {
    if (!cloud || identityLoading || hiddenActive || !isCurrentContext())
      return;
    const snapshot = currentSnapshot();
    if (
      !snapshot?.operationId ||
      !isOnline ||
      !currentOnline.current ||
      busy.current ||
      userId !== cloud.userId ||
      server !== cloud.server ||
      snapshot.id !== cloud.id ||
      snapshot.role === "viewer" ||
      remote?.id !== snapshot.id ||
      remote.revision !== snapshot.revision ||
      remote.operationId !== snapshot.operationId
    )
      return;
    busy.current = true;
    setBusy(true);
    const sequence = ++requestSequence.current;
    markSettled(sequence);
    const isCurrentRequest = (): boolean =>
      sequence === settledSequence.current;
    void client
      .request<NetworkSnapshot>(`/network/books/${snapshot.id}/operations`, {
        method: "POST",
        body: {
          key: newId(),
          revision: snapshot.revision,
          undoId: snapshot.operationId,
        },
      })
      .then(async (saved) => {
        if (observe(saved))
          await accept({
            snapshot: saved,
            isCurrentRequest,
            source: "server-write",
          });
        if (isCurrentContext() && isCurrentRequest())
          local.notify("已撤销，操作历史已保留。");
      })
      .catch(async (cause: unknown) => {
        if (!isCurrentContext() || !isCurrentRequest()) return;
        if (networkGuards.isRevokedStatus(cause)) {
          try {
            await revokeCache(
              cause instanceof Error ? cause.message : "联网账本权限已撤销。",
            );
          } catch {
            /* The current session remains revoked and the error is visible. */
          }
        } else {
          setError(cause instanceof Error ? cause.message : "撤销失败。");
        }
      })
      .finally(() => {
        busy.current = false;
        if (mounted.current) setBusy(false);
      });
  }
  const personal = local.books.find((book) => book.id === "personal");
  const publicLocal: LedgerController = {
    ...local,
    books: visibleBooks,
    error: error || local.error,
    personalLedger: personal?.cloud ? EMPTY_LEDGER : local.personalLedger,
    createBook,
    updateBooks,
    switchMode,
    commit: async (next, options) => {
      const externalGuard =
        typeof options === "object" ? options?.assertCurrent : undefined;
      const existing =
        typeof options === "string" ? { mode: options } : (options ?? {});
      const assertCurrent = (): void => {
        assertUsable();
        externalGuard?.();
      };
      assertCurrent();
      await local.commit(next, { ...existing, assertCurrent });
    },
    undo: () => {
      try {
        assertUsable();
        if (!local.undoWithGuard) {
          setError("当前账本控制器不支持安全撤销，请重新打开账本。");
          return;
        }
        local.undoWithGuard(assertUsable);
      } catch {
        /* The old context is no longer writable. */
      }
    },
    undoWithGuard: undefined,
    decide: (review, decision, options) => {
      try {
        const assertCurrent = (): void => {
          assertUsable();
          options?.assertCurrent?.();
        };
        assertCurrent();
        local.decide(review, decision, { assertCurrent });
      } catch {
        /* The old context is no longer writable. */
      }
    },
    editRecord: async (record, options) => {
      const assertCurrent = (): void => {
        assertUsable();
        options?.assertCurrent?.();
      };
      assertCurrent();
      await local.editRecord(record, { assertCurrent });
    },
  };
  if (identityLoading || hiddenActive)
    return {
      ...publicLocal,
      ledger: EMPTY_LEDGER,
      personalLedger: EMPTY_LEDGER,
      isLoading: true,
      canUndo: false,
      error:
        !fallback && !identityLoading && !local.isLoading
          ? "没有可用的本地账本，请登录对应账号后重试。"
          : local.error,
      network: {
        isConnected: false,
        isOnline: false,
        isIdentityBlocked: Boolean(
          !identityLoading && !local.isLoading && hiddenActive && !fallback,
        ),
        error: "",
        refresh,
      },
    };
  if (!cloud)
    return {
      ...publicLocal,
      network: {
        isConnected: false,
        isOnline: false,
        error: "",
        refresh,
        prepareCache,
      },
    };
  const isIdentityValid = userId === cloud.userId && server === cloud.server;
  const ledger =
    !isIdentityValid || isRevoked
      ? EMPTY_LEDGER
      : (remote?.ledger ??
        (cache?.status === "verified" ? cache.ledger : undefined) ??
        EMPTY_LEDGER);
  const isCurrentOnline = Boolean(remote && isOnline && currentOnline.current);
  const canReceive = Boolean(isIdentityValid && isCurrentOnline && !isRevoked);
  return {
    ...publicLocal,
    ledger,
    isSaving: local.isSaving || isBusy,
    error: error || local.error,
    canUndo: Boolean(
      isIdentityValid &&
      remote?.id === cloud.id &&
      remote.operationId &&
      remote.role !== "viewer" &&
      isCurrentOnline,
    ),
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
      isOnline: isCurrentOnline,
      role: remote?.role ?? cloud.role,
      revision: remote?.revision,
      error,
      refresh,
      prepareCache,
      revokeCache: () => revokeCache("联网账本权限已撤销。", true),
      contextToken,
      authorizationToken: sessionToken,
      receive: async (snapshot) => {
        if (
          !isCurrentContext() ||
          !canReceive ||
          capturedAuthorizationEpoch !== authorizationEpoch.current ||
          snapshot.id !== cloud.id ||
          !isIdentityValid
        )
          throw new Error("联网账本权限或身份已变化。");
        if (!observe(snapshot)) return;
        const sequence = ++requestSequence.current;
        markSettled(sequence);
        await accept({
          snapshot,
          isCurrentRequest: () => sequence === settledSequence.current,
          source: "server-write",
        });
      },
    },
  };
}
