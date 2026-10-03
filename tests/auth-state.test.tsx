// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { AuthProvider } from "../apps/web/src/auth/AuthProvider";
import { useAuth } from "../apps/web/src/auth/auth-context";
import { cloud } from "../apps/web/src/platform/browser/cloud";
import type { AuthReceipt } from "../apps/web/src/platform/browser/auth-model";
vi.mock("../apps/web/src/platform/browser/cloud", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../apps/web/src/platform/browser/cloud")
    >();
  return {
    ...actual,
    cloud: {
      me: vi.fn(),
      authenticate: vi.fn(),
      logout: vi.fn(),
      activity: vi.fn(),
    },
  };
});
const anonymous: AuthReceipt = { user: null, session: null, csrfToken: null };
const receipt: AuthReceipt = {
  user: { id: "user", username: "test" },
  session: { id: "session", expiresAt: 9999999999999, remember: false },
  csrfToken: "synthetic-csrf",
};
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  history.replaceState(null, "", "/");
  vi.mocked(cloud.me).mockResolvedValue(anonymous);
  vi.mocked(cloud.authenticate).mockResolvedValue(receipt);
  vi.mocked(cloud.logout).mockResolvedValue({ ok: true });
  vi.mocked(cloud.activity).mockResolvedValue({ ok: true });
});
afterEach(cleanup);
it("ignores an old session check that finishes after a successful login", async () => {
  let resolve!: (value: AuthReceipt) => void;
  vi.mocked(cloud.me).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const hook = renderHook(useAuth, { wrapper: AuthProvider });
  await act(async () =>
    hook.result.current.authenticate({
      username: "test",
      password: "synthetic-password",
      isRegister: false,
    }),
  );
  await act(async () => resolve(anonymous));
  expect(hook.result.current.user?.id).toBe("user");
});
it("keeps local-only use local even if a valid cookie exists", async () => {
  sessionStorage.setItem("hamster-ledger.workspace-access", "local");
  vi.mocked(cloud.me).mockResolvedValue(receipt);
  const hook = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.isChecking).toBe(false));
  expect(hook.result.current.user).toBeNull();
  expect(hook.result.current.isLocalOnly).toBe(true);
  expect(hook.result.current.localAccess).toBe(true);
});
it("lets local mode continue immediately while the server check is pending", async () => {
  let resolve!: (value: AuthReceipt) => void;
  vi.mocked(cloud.me).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const hook = renderHook(useAuth, { wrapper: AuthProvider });
  act(() => hook.result.current.continueLocal());
  await act(async () => resolve(receipt));
  expect(hook.result.current.user).toBeNull();
  expect(hook.result.current.localAccess).toBe(true);
});
it("retains local access but reports expired cloud authentication", async () => {
  vi.mocked(cloud.me).mockResolvedValue(receipt);
  const hook = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.user).not.toBeNull());
  vi.mocked(cloud.me).mockResolvedValue(anonymous);
  await act(async () => hook.result.current.refresh());
  expect(hook.result.current.user).toBeNull();
  expect(hook.result.current.localAccess).toBe(true);
  expect(hook.result.current.error).toContain("登录已失效");
});
it("keeps a login cooldown across successful background session checks", async () => {
  const { CloudError } = await import("../apps/web/src/platform/browser/cloud");
  const hook = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.isChecking).toBe(false));
  vi.mocked(cloud.authenticate).mockRejectedValue(
    new CloudError(429, {
      message: "稍后重试",
      code: "rate_limited",
      retryAfter: 900,
    }),
  );
  await act(async () => {
    await expect(
      hook.result.current.authenticate({
        username: "test",
        password: "synthetic-password",
        isRegister: false,
      }),
    ).rejects.toThrow("稍后重试");
  });
  await act(async () => hook.result.current.refresh());
  expect(hook.result.current.retryAfter).toBe(900);
});
