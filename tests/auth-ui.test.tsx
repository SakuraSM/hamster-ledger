// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import {
  AuthContext,
  type AuthController,
} from "../apps/web/src/auth/auth-context";
import { AuthPage } from "../apps/web/src/components/auth/AuthPage";
import { DEFAULT_AUTH_POLICY } from "../apps/web/src/platform/browser/auth-model";
import { safeReturnPath } from "../apps/web/src/platform/browser/auth-navigation";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function controller(patch: Partial<AuthController> = {}): AuthController {
  return {
    user: null,
    session: null,
    policy: { ...DEFAULT_AUTH_POLICY, allowRegistration: true },
    isChecking: false,
    isBusy: false,
    error: "",
    isOffline: false,
    localAccess: false,
    isLocalOnly: false,
    retryAfter: 0,
    clearError: vi.fn(),
    authenticate: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    continueLocal: vi.fn(),
    changePassword: vi.fn(async () => {}),
    ...patch,
  };
}
function mount(mode: "login" | "register", auth = controller()) {
  render(
    <AuthContext.Provider value={auth}>
      <AuthPage mode={mode} />
    </AuthContext.Provider>,
  );
  return auth;
}
it("provides a full login form, password visibility, and an explicit local-only entry", async () => {
  const auth = mount("login");
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: "test.user" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "test-password-value" },
  });
  expect((screen.getByLabelText("密码") as HTMLInputElement).type).toBe(
    "password",
  );
  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  expect((screen.getByLabelText("密码") as HTMLInputElement).type).toBe("text");
  fireEvent.click(screen.getByLabelText("记住登录 30 天"));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "登录" })),
  );
  expect(auth.authenticate).toHaveBeenCalledWith({
    username: "test.user",
    password: "test-password-value",
    isRegister: false,
    remember: true,
  });
  fireEvent.click(screen.getByRole("button", { name: "仅在本机使用" }));
  expect(auth.continueLocal).toHaveBeenCalledOnce();
});
it("rejects mismatched registration passwords before making a request", async () => {
  const auth = mount("register");
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: "new.user" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "new-password-value" },
  });
  fireEvent.change(screen.getByLabelText("确认密码"), {
    target: { value: "different-password" },
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "创建账号" })),
  );
  expect(screen.getByText("两次输入的密码不一致")).toBeTruthy();
  expect(auth.authenticate).not.toHaveBeenCalled();
});
it("does not present a registration form when the server disables registration", () => {
  mount("register", controller({ policy: DEFAULT_AUTH_POLICY }));
  expect(screen.getByText("注册尚未开放")).toBeTruthy();
  expect(screen.queryByLabelText("账号")).toBeNull();
});
it("honors Retry-After before enabling another login attempt", async () => {
  vi.useFakeTimers();
  mount("login", controller({ retryAfter: 2, error: "尝试次数过多" }));
  expect(
    (screen.getByRole("button", { name: "2 秒后重试" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => vi.advanceTimersByTime(2000));
  expect(
    (screen.getByRole("button", { name: "登录" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it.each([
  "https://evil.example",
  "//evil.example",
  "javascript:alert(1)",
  "/login",
  "/\\evil.example",
])(
  "does not redirect login outside the supported app destination: %s",
  (value) => {
    expect(safeReturnPath(value, "https://ledger.example")).toBe("/");
  },
);
it("preserves only supported internal return parameters", () => {
  expect(
    safeReturnPath(
      "/?page=tools&next=https://evil.example",
      "https://ledger.example",
    ),
  ).toBe("/?page=tools");
});
it("rejects an obsolete server response before treating a user as signed in", async () => {
  const { parseAuthReceipt } =
    await import("../apps/web/src/platform/browser/auth-receipt");
  expect(() =>
    parseAuthReceipt({ user: { id: "legacy", username: "legacy" } }),
  ).toThrow("登录协议不兼容");
});
