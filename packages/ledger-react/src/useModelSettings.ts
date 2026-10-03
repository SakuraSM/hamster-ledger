import { useEffect, useRef, useState } from "react";
import type { NetworkClient } from "./network-model.js";
export interface ModelConfig {
  endpoint: string;
  model: string;
  allowLan: boolean;
  noKey: boolean;
  vision: boolean;
}
export interface ModelProfile {
  config: ModelConfig | null;
  hasKey: boolean;
}
export interface ModelSettings {
  profile: ModelProfile;
  draft: ModelConfig;
  key: string;
  clearKey: boolean;
  models: string[];
  error: string;
  message: string;
  isBusy: boolean;
  isLoading: boolean;
  change: <Key extends keyof ModelConfig>(
    key: Key,
    value: ModelConfig[Key],
  ) => void;
  setKey: (value: string) => void;
  setClearKey: (value: boolean) => void;
  save: () => Promise<void>;
  test: (vision: boolean) => Promise<void>;
  list: () => Promise<void>;
  remove: () => Promise<void>;
}
const EMPTY_PROFILE: ModelProfile = { config: null, hasKey: false };
const DEFAULT_CONFIG: ModelConfig = {
  endpoint: "https://api.openai.com/v1",
  model: "",
  allowLan: false,
  noKey: false,
  vision: false,
};
export function useModelSettings(
  client: NetworkClient,
  isAuthenticated: boolean,
): ModelSettings {
  const [profile, setProfile] = useState<ModelProfile>(EMPTY_PROFILE),
    [draft, setDraft] = useState(DEFAULT_CONFIG),
    [key, setKey] = useState(""),
    [clearKey, setClearKey] = useState(false),
    [models, setModels] = useState<string[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [isBusy, setBusy] = useState(false);
  const [isLoading, setLoading] = useState(isAuthenticated);
  const locked = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setProfile(EMPTY_PROFILE);
    setKey("");
    setModels([]);
    setDraft(DEFAULT_CONFIG);
    setLoading(isAuthenticated);
    if (!isAuthenticated) return;
    void client
      .request<ModelProfile>("/models/profile")
      .then((value) => {
        if (current === generation.current) {
          setProfile(value);
          setDraft(value.config ?? DEFAULT_CONFIG);
        }
      })
      .catch((cause: unknown) => {
        if (current === generation.current)
          setError(
            cause instanceof Error ? cause.message : "读取模型配置失败。",
          );
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [client, isAuthenticated]);
  async function run(action: () => Promise<void>): Promise<void> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!isAuthenticated) throw new Error("请先登录服务端账号，再配置模型。");
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型操作失败。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    profile,
    draft,
    key,
    clearKey,
    models,
    error,
    message,
    isBusy,
    isLoading,
    change: (field, value) =>
      setDraft((previous) => ({ ...previous, [field]: value })),
    setKey,
    setClearKey,
    save: () =>
      run(async () => {
        const current = generation.current;
        const saved = await client.request<ModelProfile>("/models/profile", {
          method: "PUT",
          body: { ...draft, ...(key ? { key } : {}), clearKey },
        });
        if (current !== generation.current) return;
        setProfile(saved);
        setKey("");
        setClearKey(false);
        setMessage("模型配置已保存，密钥不会回传。");
      }),
    list: () =>
      run(async () => {
        const current = generation.current;
        const result = await client.request<{ models: string[] }>(
          "/models/list",
        );
        if (current === generation.current) {
          setModels(result.models);
          setMessage(`已读取 ${result.models.length} 个模型。`);
        }
      }),
    test: (vision) =>
      run(async () => {
        const current = generation.current;
        const result = await client.request<{ note: string }>("/models/test", {
          method: "POST",
          body: { vision },
        });
        if (current === generation.current) setMessage(result.note);
      }),
    remove: () =>
      run(async () => {
        const current = generation.current;
        await client.request("/models/profile", { method: "DELETE", body: {} });
        if (current === generation.current) {
          setProfile(EMPTY_PROFILE);
          setDraft(DEFAULT_CONFIG);
          setKey("");
          setMessage("模型配置已移除。");
        }
      }),
  };
}
