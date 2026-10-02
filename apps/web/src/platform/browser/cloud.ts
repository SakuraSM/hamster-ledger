import { ledgerSchema, type Ledger } from "@hamster-ledger/core";
export interface CloudUser {
  id: string;
  username: string;
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
export class CloudError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Hamster-Client": "1",
      ...options.headers,
    },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CloudError(
      response.status,
      "当前预览未连接同步服务。请打开自托管服务地址。",
    );
  }
  if (!response.ok)
    throw new CloudError(
      response.status,
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "同步请求失败。",
    );
  return body as T;
}
export const cloud = {
  me: () => request<{ user: CloudUser | null }>("/auth/me"),
  authenticate: (input: {
    username: string;
    password: string;
    isRegister: boolean;
  }) =>
    request<{ user: CloudUser }>(
      "/auth/" + (input.isRegister ? "register" : "login"),
      {
        method: "POST",
        body: JSON.stringify({
          username: input.username,
          password: input.password,
        }),
      },
    ),
  logout: () =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" }),
  books: () => request<{ books: CloudBook[] }>("/books"),
  async load(id: string): Promise<CloudSnapshot> {
    const snapshot = await request<CloudSnapshot>(
      "/books/" + encodeURIComponent(id),
    );
    return { ...snapshot, ledger: ledgerSchema.parse(snapshot.ledger) };
  },
  save: (input: {
    id?: string;
    name: string;
    ledger: Ledger;
    revision?: number;
  }) =>
    request<CloudBook>(
      "/books" + (input.id ? "/" + encodeURIComponent(input.id) : ""),
      { method: input.id ? "PUT" : "POST", body: JSON.stringify(input) },
    ),
};
