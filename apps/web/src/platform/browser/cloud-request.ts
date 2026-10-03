const REQUEST_TIMEOUT_MS = 15000;
export const AUTH_INVALID_EVENT = "hamster-auth-invalid";
let credentials: { userId: string; csrfToken: string } | null = null;
let credentialGeneration = 0;
export function setCloudCredentials(
  next: { userId: string; csrfToken: string } | null,
): void {
  if (
    credentials?.userId !== next?.userId ||
    credentials?.csrfToken !== next?.csrfToken
  ) {
    credentials = next;
    credentialGeneration++;
  }
}
export function cloudCredentialGeneration(): number {
  return credentialGeneration;
}
export class CloudError extends Error {
  readonly code: string;
  readonly retryAfter: number;
  constructor(
    public status: number,
    input: string | { message: string; code?: string; retryAfter?: number },
  ) {
    super(typeof input === "string" ? input : input.message);
    this.code =
      typeof input === "string"
        ? "request_failed"
        : (input.code ?? "request_failed");
    this.retryAfter = typeof input === "string" ? 0 : (input.retryAfter ?? 0);
  }
}
interface RequestOptions extends RequestInit {
  expectedUserId?: string;
}
export async function cloudRequest<Result>(
  path: string,
  { expectedUserId, ...options }: RequestOptions = {},
): Promise<Result> {
  const generation = credentialGeneration;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api" + path, {
      ...options,
      signal: options.signal ?? controller.signal,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Hamster-Client": "1",
        ...(credentials?.csrfToken
          ? { "X-CSRF-Token": credentials.csrfToken }
          : {}),
        ...(expectedUserId ? { "X-Hamster-User": expectedUserId } : {}),
        ...options.headers,
      },
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CloudError(response.status, {
        message: "当前地址未提供账号服务，请检查自托管服务是否已启动。",
        code: "service_unavailable",
      });
    }
    if (!response.ok) {
      const data = body && typeof body === "object" ? body : {};
      const code = "code" in data ? String(data.code) : "request_failed";
      const error =
        "error" in data ? String(data.error) : "请求失败，请稍后重试。";
      if (["session_expired", "account_changed", "csrf_invalid"].includes(code))
        window.dispatchEvent(
          new CustomEvent(AUTH_INVALID_EVENT, {
            detail: { generation, expectedUserId, message: error },
          }),
        );
      throw new CloudError(response.status, {
        message: error,
        code,
        retryAfter: Number(response.headers.get("Retry-After") ?? 0),
      });
    }
    return body as Result;
  } catch (cause) {
    if (cause instanceof CloudError) throw cause;
    throw new CloudError(0, {
      message: controller.signal.aborted
        ? "请求超时，请重试。"
        : "暂时无法连接同步服务。本机账本仍可使用。",
      code: "offline",
    });
  } finally {
    clearTimeout(timer);
  }
}
