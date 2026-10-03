import { parseAuthReceipt } from "./auth-receipt";
import { ledgerSchema, type Ledger } from "@hamster-ledger/core";
import { cloudRequest as request } from "./cloud-request";
import type { AuthReceipt, AuthInput, DeviceSession } from "./auth-model";
export { CloudError } from "./cloud-request";
export type { CloudUser } from "./auth-model";
export interface CloudBook {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
}
export interface CloudSnapshot extends CloudBook {
  ledger: Ledger;
}
export const cloud = {
  me: async (): Promise<AuthReceipt> =>
    parseAuthReceipt(await request<unknown>("/auth/me")),
  authenticate: async (input: AuthInput): Promise<AuthReceipt> =>
    parseAuthReceipt(
      await request<unknown>(
        "/auth/" + (input.isRegister ? "register" : "login"),
        {
          method: "POST",
          body: JSON.stringify({
            username: input.username,
            password: input.password,
            remember: input.remember ?? false,
          }),
        },
      ),
    ),
  logout: (expectedUserId?: string) =>
    request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: "{}",
      expectedUserId,
    }),
  activity: (expectedUserId: string) =>
    request<{ ok: boolean }>("/auth/activity", {
      method: "POST",
      body: "{}",
      expectedUserId,
    }),
  sessions: (expectedUserId: string) =>
    request<{ sessions: DeviceSession[] }>("/auth/sessions", {
      expectedUserId,
    }),
  changePassword: async (
    input: { currentPassword: string; newPassword: string },
    expectedUserId: string,
  ): Promise<AuthReceipt> =>
    parseAuthReceipt(
      await request<unknown>("/auth/password", {
        method: "POST",
        body: JSON.stringify(input),
        expectedUserId,
      }),
      false,
    ),
  revokeOthers: (currentPassword: string, expectedUserId: string) =>
    request<{ ok: boolean; revoked: number }>("/auth/logout-others", {
      method: "POST",
      body: JSON.stringify({ currentPassword }),
      expectedUserId,
    }),
  revokeSession: (
    input: { id: string; currentPassword: string },
    expectedUserId: string,
  ) =>
    request<{ ok: boolean; isCurrent: boolean }>(
      "/auth/sessions/" + encodeURIComponent(input.id),
      {
        method: "DELETE",
        body: JSON.stringify({ currentPassword: input.currentPassword }),
        expectedUserId,
      },
    ),
  books: (expectedUserId?: string) =>
    request<{ books: CloudBook[] }>("/books", { expectedUserId }),
  async load(id: string, expectedUserId?: string): Promise<CloudSnapshot> {
    const snapshot = await request<CloudSnapshot>(
      "/books/" + encodeURIComponent(id),
      { expectedUserId },
    );
    return { ...snapshot, ledger: ledgerSchema.parse(snapshot.ledger) };
  },
  save: ({
    userId,
    ...input
  }: {
    id?: string;
    name: string;
    ledger: Ledger;
    revision?: number;
    userId?: string;
  }) =>
    request<CloudBook>(
      "/books" + (input.id ? "/" + encodeURIComponent(input.id) : ""),
      {
        method: input.id ? "PUT" : "POST",
        body: JSON.stringify(input),
        expectedUserId: userId,
      },
    ),
};
