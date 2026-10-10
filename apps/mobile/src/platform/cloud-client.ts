import { ledgerSchema, type Ledger } from "@hamster-ledger/core";
export interface CloudUser {
  id: string;
  username: string;
  mustChangePassword: boolean;
}
export interface CloudSession {
  id: string;
  expiresAt: number;
  remember: boolean;
}
export interface Credentials {
  accessToken: string;
  csrfToken: string;
  user: CloudUser;
  session: CloudSession;
}
export interface AuthPolicy {
  allowRegistration: boolean;
  minimumPasswordLength: number;
  maximumPasswordLength: number;
}
export interface AuthReceipt {
  user: CloudUser | null;
  csrfToken: string | null;
  session: CloudSession | null;
  accessToken?: string;
  policy?: AuthPolicy;
}
export interface CloudBook {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
}
export interface CloudSnapshot extends CloudBook {
  ledger: Ledger;
}
export interface DeviceSession extends CloudSession {
  deviceName: string;
  isCurrent: boolean;
  lastSeenAt: number;
}
export class CloudError extends Error {
  code: string;
  constructor(
    public status: number,
    detail: { message: string; code?: string },
  ) {
    super(detail.message);
    this.code = detail.code ?? "request_failed";
  }
}
export function normalizeServer(
  value: string,
  allowLocalDevelopment = false,
): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请填写完整的 HTTPS 服务地址。");
  }
  const local = ["localhost", "127.0.0.1", "10.0.2.2", "[::1]"].includes(
    url.hostname,
  );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    !(
      url.protocol === "https:" ||
      (allowLocalDevelopment && local && url.protocol === "http:")
    )
  )
    throw new Error("服务地址需使用 HTTPS，且不包含路径、账号或密码。");
  return url.origin;
}
export function parseCredentials(
  value: AuthReceipt,
  fallbackToken?: string,
): Credentials {
  const accessToken = value.accessToken ?? fallbackToken;
  if (
    !accessToken ||
    !/^[A-Za-z0-9_-]{43}$/.test(accessToken) ||
    !value.user?.id ||
    !value.user.username ||
    !value.csrfToken ||
    !value.session?.id ||
    !Number.isFinite(value.session.expiresAt)
  )
    throw new Error("服务返回的登录凭据无效，请检查服务版本。");
  return {
    accessToken,
    csrfToken: value.csrfToken,
    user: value.user,
    session: value.session,
  };
}
interface CloudClientOptions {
  origin: string;
  getCredentials: () => Credentials | null;
  invalidate: () => Promise<void>;
  fetcher?: typeof fetch;
}
interface AuthInput {
  username: string;
  password: string;
  remember: boolean;
  isRegister: boolean;
}
interface SaveBookInput {
  id?: string;
  revision?: number;
  name: string;
  ledger: Ledger;
}
export interface CloudClient {
  request<T>(
    path: string,
    options?: { method?: string; body?: unknown },
  ): Promise<T>;
  me: () => Promise<AuthReceipt>;
  authenticate: (input: AuthInput) => Promise<AuthReceipt>;
  logout: () => Promise<{ ok: boolean }>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<AuthReceipt>;
  sessions: () => Promise<{ sessions: DeviceSession[] }>;
  revoke: (
    id: string,
    currentPassword: string,
  ) => Promise<{ isCurrent: boolean }>;
  books: () => Promise<{ books: CloudBook[] }>;
  load: (id: string) => Promise<CloudSnapshot>;
  save: (input: SaveBookInput) => Promise<CloudBook>;
}
const REQUEST_TIMEOUT_MS = 15_000;
export function createCloudClient({
  origin,
  getCredentials,
  invalidate,
  fetcher = fetch,
}: CloudClientOptions): CloudClient {
  async function request<T>(
    path: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const auth = getCredentials();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetcher(origin + "/api/native" + path, {
        method,
        credentials: "omit",
        redirect: "error",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          ...(auth
            ? {
                Authorization: "Bearer " + auth.accessToken,
                "X-CSRF-Token": auth.csrfToken,
                "X-Hamster-User": auth.user.id,
              }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = (await response.json()) as T & {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        if (
          ["session_expired", "account_changed"].includes(result.code ?? "") &&
          auth === getCredentials()
        )
          await invalidate();
        throw new CloudError(response.status, {
          message: result.error ?? "服务请求失败。",
          code: result.code,
        });
      }
      return result;
    } catch (cause) {
      if (cause instanceof CloudError) throw cause;
      throw new CloudError(0, {
        message: "无法连接同步服务，请检查地址与网络。本机账本已保留。",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    request,
    me: () => request<AuthReceipt>("/auth/me"),
    authenticate: (input: AuthInput) =>
      request<AuthReceipt>(
        input.isRegister ? "/auth/register" : "/auth/login",
        { method: "POST", body: input },
      ),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", { method: "POST", body: {} }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<AuthReceipt>("/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      }),
    sessions: () => request<{ sessions: DeviceSession[] }>("/auth/sessions"),
    revoke: (id: string, currentPassword: string) =>
      request<{ isCurrent: boolean }>(
        "/auth/sessions/" + encodeURIComponent(id),
        { method: "DELETE", body: { currentPassword } },
      ),
    books: () => request<{ books: CloudBook[] }>("/books"),
    async load(id: string): Promise<CloudSnapshot> {
      const snapshot = await request<CloudSnapshot>(
        "/books/" + encodeURIComponent(id),
      );
      return { ...snapshot, ledger: ledgerSchema.parse(snapshot.ledger) };
    },
    save: (input: SaveBookInput) =>
      request<CloudBook>(
        "/books" + (input.id ? "/" + encodeURIComponent(input.id) : ""),
        { method: input.id ? "PUT" : "POST", body: input },
      ),
  };
}
