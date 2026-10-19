// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  NativeAccountProvider,
  useNativeAccount,
} from "../../apps/mobile/src/auth/NativeAccount";
import { createAccountOperations } from "../../apps/mobile/src/auth/account-operations";

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    storage.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    storage.delete(key);
  },
}));
vi.mock("../../apps/mobile/src/platform/storage", () => ({
  nativeStore: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));
const anonymous = { user: null, session: null, csrfToken: null };
const receipt = {
  accessToken: "a".repeat(43),
  csrfToken: "synthetic-csrf",
  user: { id: "a", username: "synthetic", mustChangePassword: false },
  session: { id: "session-a", expiresAt: 9999999999999, remember: true },
};
const login = {
  username: "synthetic",
  password: "synthetic-test-only",
  remember: true,
  isRegister: false,
};
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
beforeEach(() => {
  storage.clear();
  vi.stubGlobal("__DEV__", false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      response(url.endsWith("/auth/login") ? receipt : anonymous),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function account(): Promise<
  ReturnType<typeof renderHook<ReturnType<typeof useNativeAccount>, unknown>>
> {
  const hook = renderHook(useNativeAccount, { wrapper: NativeAccountProvider });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}
it("keeps the provider operation locked even when a caller tries to connect another origin", async () => {
  const hook = await account();
  await act(() => hook.result.current.connect("https://a.example"));
  const delayed = deferred<Response>();
  vi.mocked(fetch).mockImplementationOnce(() => delayed.promise);
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.authenticate(login);
  });
  await act(async () => {
    await expect(
      hook.result.current.connect("https://b.example"),
    ).rejects.toThrow("正在处理");
    delayed.resolve(response(receipt));
    await pending;
  });
  expect(hook.result.current.server).toBe("https://a.example");
  await act(() => hook.result.current.connect("https://b.example"));
  expect(hook.result.current.credentials).toBeNull();
  await hook.result.current.client.books();
  expect(vi.mocked(fetch).mock.lastCall?.[1]?.headers).not.toHaveProperty(
    "Authorization",
  );
});
it("rejects authentication while an old connect is still pending", async () => {
  const hook = await account();
  const delayed = deferred<Response>();
  vi.mocked(fetch).mockImplementationOnce(() => delayed.promise);
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.connect("https://b.example");
  });
  await act(async () => {
    await expect(
      hook.result.current.connect("https://a.example"),
    ).rejects.toThrow("正在处理");
    await expect(hook.result.current.authenticate(login)).rejects.toThrow(
      "正在处理",
    );
    delayed.resolve(response(anonymous));
    await pending;
  });
  await act(() => hook.result.current.connect("https://a.example"));
  await act(() => hook.result.current.authenticate(login));
  expect(hook.result.current.credentials?.accessToken).toBe(
    receipt.accessToken,
  );
  expect(hook.result.current.server).toBe("https://a.example");
});
it("an old anonymous error cannot clear a later login on another server", async () => {
  const hook = await account();
  await act(() => hook.result.current.connect("https://a.example"));
  const delayed = deferred<Response>();
  vi.mocked(fetch).mockImplementationOnce(() => delayed.promise);
  const old = hook.result.current.client.me();
  const rejected = expect(old).rejects.toThrow();
  await act(() => hook.result.current.connect("https://b.example"));
  await act(() => hook.result.current.authenticate(login));
  await act(async () => {
    delayed.resolve(response({ code: "session_expired" }, 401));
    await rejected;
  });
  expect(hook.result.current.credentials?.accessToken).toBe(
    receipt.accessToken,
  );
});
it("queues invalidation behind an already-started credential write", async () => {
  const operations = createAccountOperations();
  const delayed = deferred<void>();
  let saved = "";
  const oldVersion = operations.version();
  const write = operations.persist(oldVersion, async () => {
    await delayed.promise;
    saved = "old-token";
  });
  const rejected = expect(write).rejects.toThrow("已变化");
  await Promise.resolve();
  const nextVersion = operations.cancel();
  const clear = operations.persist(nextVersion, async () => {
    saved = "";
  });
  delayed.resolve();
  await rejected;
  await clear;
  expect(saved).toBe("");
});
