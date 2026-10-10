import { useEffect, useRef, useState } from "react";
import type { NetworkClient } from "./network-model.js";
export const TOKEN_SCOPES = [
  { value: "records:read", label: "查询账单与账户" },
  { value: "records:write", label: "创建账单" },
  { value: "ai:recognize", label: "识别 AI 草稿" },
  { value: "ai:confirm", label: "确认 AI 草稿入账" },
  { value: "attachments:read", label: "读取附件" },
  { value: "attachments:write", label: "上传附件" },
];
export interface OpenToken {
  id: string;
  name: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
  revokedAt: number | null;
  createdAt: string;
}
export interface OpenTokens {
  tokens: OpenToken[];
  secret: string;
  error: string;
  isBusy: boolean;
  create: (name: string, scopes: string[], days: number) => Promise<void>;
  revoke: (id: string) => Promise<void>;
  dismiss: () => void;
}
export function useOpenTokens(
  client: NetworkClient,
  bookId: string,
): OpenTokens {
  const [tokens, setTokens] = useState<OpenToken[]>([]),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const generation = useRef(0),
    lock = useRef(false);
  const endpoint = `/network/books/${bookId}/tokens`;
  useEffect(() => {
    const current = ++generation.current;
    setTokens([]);
    setSecret("");
    setError("");
    void client
      .request<{ tokens: OpenToken[] }>(`/network/books/${bookId}/tokens`)
      .then((result) => {
        if (current === generation.current) setTokens(result.tokens);
      })
      .catch((cause: unknown) => {
        if (current === generation.current)
          setError(cause instanceof Error ? cause.message : "读取令牌失败。");
      });
    return () => {
      generation.current++;
    };
  }, [client, bookId]);
  async function run(action: () => Promise<string | void>): Promise<void> {
    if (lock.current) return;
    const current = generation.current;
    lock.current = true;
    setBusy(true);
    setError("");
    setSecret("");
    try {
      const value = await action();
      if (current !== generation.current) return;
      if (value) setSecret(value);
      const result = await client.request<{ tokens: OpenToken[] }>(endpoint);
      if (current === generation.current) setTokens(result.tokens);
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : "令牌操作失败。");
    } finally {
      lock.current = false;
      if (current === generation.current) setBusy(false);
    }
  }
  return {
    tokens,
    secret,
    error,
    isBusy,
    dismiss: () => setSecret(""),
    create: (name, scopes, days) =>
      run(
        async () =>
          (
            await client.request<{ token: string }>(endpoint, {
              method: "POST",
              body: { name, scopes, days },
            })
          ).token,
      ),
    revoke: (id) =>
      run(async () => {
        await client.request(`${endpoint}/${id}`, {
          method: "DELETE",
          body: {},
        });
      }),
  };
}
