import type { LedgerMode } from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";
import type { NetworkSnapshot } from "./network-model.js";

const REVOKED_STATUS = { unauthorized: 401, forbidden: 403, missing: 404 };

type CommitOptions = Parameters<LedgerController["commit"]>[1];
interface NetworkCommitGuardInput {
  modeOrOptions: CommitOptions;
  capturedMode: LedgerMode;
  books: LedgerController["books"];
  isCurrentContext: boolean;
  isOnline: boolean;
  snapshot: NetworkSnapshot | null;
  rendered: NetworkSnapshot | null;
  userId: string | null;
  server: string;
  isBusy: boolean;
}

export function isRevokedStatus(cause: unknown): boolean {
  return Boolean(
    cause &&
    typeof cause === "object" &&
    "status" in cause &&
    Object.values(REVOKED_STATUS).includes(Number(cause.status)),
  );
}

export function guardNetworkCommit(input: NetworkCommitGuardInput): {
  mode: LedgerMode;
  snapshot: NetworkSnapshot | null;
} {
  const options =
    typeof input.modeOrOptions === "string" ? undefined : input.modeOrOptions;
  const mode =
    typeof input.modeOrOptions === "string"
      ? input.modeOrOptions
      : (options?.mode ?? input.capturedMode);
  const { expectedRevision, expectedCloud } = options ?? {};
  if (!input.isCurrentContext)
    throw new Error("账本或登录身份已变化，请重新打开后重试。");
  const selected = input.books.find((item) => item.id === mode);
  if (expectedRevision !== undefined && !expectedCloud)
    throw new Error("缺少联网账本身份，请重新打开后重试。");
  if (!selected?.cloud) {
    if (
      mode === input.capturedMode ||
      expectedRevision !== undefined ||
      expectedCloud
    )
      throw new Error("账本绑定已变化，请重新打开后重试。");
    return { mode, snapshot: null };
  }
  if (mode !== input.capturedMode)
    throw new Error("账本已切换，请重新打开后重试。");
  if (
    expectedCloud &&
    (expectedCloud.id !== selected.cloud.id ||
      expectedCloud.userId !== selected.cloud.userId ||
      expectedCloud.server !== selected.cloud.server)
  )
    throw new Error("账本绑定或登录身份已变化，请重新打开后重试。");
  const { snapshot } = input;
  if (
    !input.isOnline ||
    !snapshot ||
    snapshot.id !== selected.cloud.id ||
    input.userId !== selected.cloud.userId ||
    input.server !== selected.cloud.server
  )
    throw new Error("联网账本当前只读，请连接正确账号后重试。");
  if (
    input.rendered?.id !== snapshot.id ||
    input.rendered.revision !== snapshot.revision ||
    (expectedRevision !== undefined && expectedRevision !== snapshot.revision)
  )
    throw new Error("账本已更新，请重新打开后重试；当前修改尚未保存。");
  if (snapshot.role === "viewer") throw new Error("你在此账本中是只读成员。");
  if (input.isBusy) throw new Error("正在保存，请稍后。");
  return { mode, snapshot };
}

export function networkContext(input: {
  local: LedgerController;
  userId: string | null;
  server: string;
}): { cloud: LedgerController["books"][number]["cloud"]; contextKey: string } {
  const cloud = input.local.books.find(
    (item) => item.id === input.local.mode,
  )?.cloud;
  return {
    cloud,
    contextKey: JSON.stringify([
      input.local.mode,
      cloud?.id ?? null,
      cloud?.userId ?? null,
      cloud?.server ?? null,
      input.userId,
      input.server,
    ]),
  };
}

export interface ActiveNetworkSession {
  token: object;
  invalidate: (reason: string) => void;
  reportFailure: (message: string) => void;
  revalidate: () => Promise<void>;
}
const activeSessions = new WeakMap<
  import("@hamster-ledger/core").LedgerRepository,
  Map<string, Set<ActiveNetworkSession>>
>();
export function registerNetworkSession(input: {
  repository: import("@hamster-ledger/core").LedgerRepository;
  key: string;
  session: ActiveNetworkSession;
}): () => void {
  let contexts = activeSessions.get(input.repository);
  if (!contexts) {
    contexts = new Map();
    activeSessions.set(input.repository, contexts);
  }
  let sessions = contexts.get(input.key);
  if (!sessions) {
    sessions = new Set();
    contexts.set(input.key, sessions);
  }
  sessions.add(input.session);
  return () => {
    sessions.delete(input.session);
    if (!sessions.size) contexts.delete(input.key);
    if (!contexts.size) activeSessions.delete(input.repository);
  };
}
export function networkSessions(
  repository: import("@hamster-ledger/core").LedgerRepository,
  key: string,
): ActiveNetworkSession[] {
  return [...(activeSessions.get(repository)?.get(key) ?? [])];
}
