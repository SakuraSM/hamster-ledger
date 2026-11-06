import { useEffect, useRef, useState } from "react";
import type { BookRole, LedgerMode } from "@hamster-ledger/core";
import type { LedgerController } from "./useLedger.js";
import type {
  NetworkBook,
  NetworkClient,
  NetworkSnapshot,
} from "./network-model.js";
export interface Member {
  id: string;
  username: string;
  role: BookRole;
}
export interface HistoryItem {
  id: string;
  userId: string;
  username: string;
  source: string;
  summary: string;
  revision: number;
  createdAt: string;
}
export interface Invitation {
  id: string;
  role: BookRole;
  expiresAt: number;
  usedBy: string | null;
  revokedAt: number | null;
}
export interface ConversionSource {
  attachmentMap?: Record<string, string>;
  sourceBookId?: string;
  revision?: number;
}
export interface NetworkManagement {
  books: NetworkBook[];
  members: Member[];
  history: HistoryItem[];
  invites: Invitation[];
  inviteCode: string;
  isBusy: boolean;
  error: string;
  message: string;
  run: (action: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  convert: () => Promise<void>;
  open: (book: NetworkBook) => Promise<void>;
  manage: (rest: string, method: string, body: unknown) => Promise<void>;
  exitBook: (remove: boolean) => Promise<void>;
  invite: (role: BookRole) => Promise<void>;
  join: (code: string) => Promise<void>;
}
export function useNetworkManagement(input: {
  controller: LedgerController;
  client: NetworkClient;
  userId: string | null;
  server: string;
  prepareConversion: (mode: LedgerMode) => Promise<ConversionSource>;
}): NetworkManagement {
  const { controller, client, userId, server, prepareConversion } = input;
  const [books, setBooks] = useState<NetworkBook[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [history, setHistory] = useState<HistoryItem[]>([]),
    [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [inviteCode, setInviteCode] = useState(""),
    [isBusy, setBusy] = useState(false);
  const book = controller.books.find((item) => item.id === controller.mode);
  const cloud = book?.cloud;
  const lock = useRef(false);
  const contextKey = `${userId ?? ""}:${server}:${cloud?.id ?? ""}`;
  const currentKey = useRef(contextKey);
  currentKey.current = contextKey;
  const openContext = JSON.stringify([
    userId,
    server,
    controller.mode,
    cloud?.id,
  ]);
  const openGeneration = useRef({ key: openContext, value: 0 });
  if (openGeneration.current.key !== openContext)
    openGeneration.current = {
      key: openContext,
      value: openGeneration.current.value + 1,
    };
  const active = useRef(input);
  active.current = input;
  async function refresh(): Promise<void> {
    if (!userId) return;
    const key = contextKey;
    const result = await client.request<{ books: NetworkBook[] }>(
      "/network/books",
    );
    if (currentKey.current !== key) return;
    setBooks(result.books);
    if (!cloud) {
      setMembers([]);
      setHistory([]);
      setInvites([]);
      return;
    }
    const [memberResult, historyResult] = await Promise.all([
      client.request<{ members: Member[] }>(
        `/network/books/${cloud.id}/members`,
      ),
      client.request<{ history: HistoryItem[] }>(
        `/network/books/${cloud.id}/history`,
      ),
    ]);
    if (currentKey.current !== key) return;
    setMembers(memberResult.members);
    setHistory(historyResult.history);
    if (["owner", "admin"].includes(controller.network?.role ?? cloud.role))
      setInvites(
        (
          await client.request<{ invites: Invitation[] }>(
            `/network/books/${cloud.id}/invites`,
          )
        ).invites,
      );
  }
  async function run(action: () => Promise<void>): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "联网账本操作失败。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    setInviteCode("");
    setBooks([]);
    setMembers([]);
    setHistory([]);
    setInvites([]);
    setError("");
    void refreshRef
      .current()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "读取联网账本失败。"),
      );
  }, [contextKey]);
  async function convert(): Promise<void> {
    if (!userId || !book || cloud)
      throw new Error("请先登录并选择个人本地账本。");
    const initialLedger = controller.ledger;
    const initialContext = contextKey;
    const source = await prepareConversion(controller.mode);
    if (
      currentKey.current !== initialContext ||
      active.current.controller.mode !== book.id ||
      active.current.controller.ledger !== initialLedger
    )
      throw new Error("转换期间账本或账号已变化，请重新检查后转换。");
    const saved = await client.request<NetworkSnapshot>("/network/books", {
      method: "POST",
      body: {
        ...source,
        confirm: true,
        name: book.name,
        ledger: controller.ledger,
      },
    });
    const current = active.current.controller;
    if (
      currentKey.current !== initialContext ||
      current.mode !== book.id ||
      current.ledger !== initialLedger
    )
      throw new Error(
        "服务端已完成转换，本地又发生变化。请保留本地账本，从联网账本列表打开服务端版本后核对。",
      );
    await current.updateBooks(
      current.books.map((item) =>
        item.id === book.id
          ? {
              ...item,
              cloud: { id: saved.id, server, userId, role: saved.role },
            }
          : item,
      ),
    );
    setMessage("已启用联网账本，原数据备份已保留。");
  }
  async function open(remote: NetworkBook): Promise<void> {
    if (!userId) throw new Error("请先登录。");
    const existing = controller.books.find(
      (item) =>
        item.cloud?.id === remote.id &&
        item.cloud.server === server &&
        item.cloud.userId === userId,
    );
    if (existing) {
      controller.switchMode(existing.id as LedgerMode);
      return;
    }
    const generation = openGeneration.current.value;
    const originalBooks = controller.books;
    const authorization = controller.network?.authorizationToken;
    const ensureCurrent = (): void => {
      if (
        openGeneration.current.value !== generation ||
        active.current.controller.mode !== controller.mode ||
        active.current.controller.books !== originalBooks ||
        (authorization &&
          active.current.controller.network?.authorizationToken !==
            authorization)
      )
        throw new Error(
          "账本或登录身份已变化；已写入的本地数据会保留，请切回原账号核对。",
        );
    };
    const snapshot = await client.request<NetworkSnapshot>(
      `/network/books/${remote.id}`,
    );
    ensureCurrent();
    if (snapshot.id !== remote.id) throw new Error("联网账本身份不匹配。");
    let cacheFailed = false;
    const prepare = Object.assign(
      async (mode: LedgerMode): Promise<void> => {
        ensureCurrent();
        try {
          if (!controller.network?.prepareCache)
            throw new Error("本机仓储不支持联网离线缓存。");
          await controller.network.prepareCache({ mode, snapshot });
        } catch (cause) {
          ensureCurrent();
          if (
            cause &&
            typeof cause === "object" &&
            "code" in cause &&
            (cause.code === "NETWORK_CONTEXT_CHANGED" ||
              cause.code === "NETWORK_CACHE_REVOKED" ||
              cause.code === "LEDGER_STORAGE_CONFLICT")
          )
            throw cause;
          cacheFailed = true;
        }
        ensureCurrent();
      },
      { assertCurrent: ensureCurrent },
    );
    await controller.createBook(
      remote.name,
      snapshot.ledger,
      { id: remote.id, server, userId, role: snapshot.role },
      prepare,
    );
    if (cacheFailed)
      controller.notify(
        "联网账本已打开，但离线缓存未保存；请检查本机存储并联网重试。",
      );
  }
  async function manage(
    rest: string,
    method: string,
    body: unknown,
  ): Promise<void> {
    if (!cloud) throw new Error("请先打开联网账本。");
    await client.request(`/network/books/${cloud.id}${rest}`, { method, body });
    await controller.network?.refresh();
  }
  async function exitBook(remove: boolean): Promise<void> {
    if (!cloud || !userId) throw new Error("请先打开联网账本。");
    await client.request(
      `/network/books/${cloud.id}${remove ? "" : `/members/${userId}`}`,
      { method: "DELETE", body: { confirm: true } },
    );
    const currentBeforeRevoke = active.current.controller;
    const contextToken = controller.network?.contextToken;
    const authorizationToken = controller.network?.authorizationToken;
    const shouldSwitch =
      currentBeforeRevoke.mode === controller.mode &&
      currentBeforeRevoke.network?.contextToken === contextToken &&
      currentBeforeRevoke.network?.authorizationToken === authorizationToken;
    let cacheFailure: unknown;
    try {
      await controller.network?.revokeCache?.();
    } catch (cause) {
      cacheFailure = cause;
    }
    const currentAfterRevoke = active.current.controller;
    if (
      shouldSwitch &&
      currentAfterRevoke.mode === controller.mode &&
      currentAfterRevoke.network?.contextToken === contextToken
    )
      currentAfterRevoke.switchMode("demo");
    if (cacheFailure) {
      const message =
        "服务端已退出，但本机撤权状态保存失败；重启离线时缓存可能仍可见。";
      controller.notify(message);
      throw new Error(message);
    }
    setMessage(remove ? "联网账本已删除。" : "已退出联网账本。");
  }
  async function invite(role: BookRole): Promise<void> {
    if (!cloud) return;
    const result = await client.request<{ code: string }>(
      `/network/books/${cloud.id}/invites`,
      { method: "POST", body: { role } },
    );
    setInviteCode(result.code);
  }
  async function join(code: string): Promise<void> {
    await client.request("/network/invites/accept", {
      method: "POST",
      body: { code },
    });
    setMessage("已加入账本，请从联网账本列表打开。");
  }
  return {
    books,
    members,
    history,
    invites,
    inviteCode,
    isBusy,
    error,
    message,
    run,
    refresh,
    convert,
    open,
    manage,
    exitBook,
    invite,
    join,
  };
}
