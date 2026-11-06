// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AccountForm } from "../../apps/mobile/src/auth/AccountForm";
import { SecurityPanel } from "../../apps/mobile/src/auth/SecurityPanel";
import { PasswordInput } from "../../apps/mobile/src/auth/PasswordInput";

const connect = vi.fn();
const authenticate = vi.fn();
const changePassword = vi.fn();
const sessions = vi.fn();
const revoke = vi.fn();
let account: {
  server: string;
  policy: {
    allowRegistration: boolean;
    minimumPasswordLength: number;
    maximumPasswordLength: number;
  } | null;
  credentials: {
    user: { id: string; mustChangePassword: boolean };
    session: { id: string };
  } | null;
  error: string;
  connect: typeof connect;
  authenticate: typeof authenticate;
  changePassword: typeof changePassword;
  client: { sessions: typeof sessions; revoke: typeof revoke };
};
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => account,
}));
vi.mock("react-native-paper", () => {
  const TextInput = ({
    label,
    value,
    onChangeText,
    secureTextEntry,
    disabled,
    right,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    secureTextEntry?: boolean;
    disabled?: boolean;
    right?: ReactNode;
  }) => (
    <div>
      <label>
        {label}
        <input
          type={secureTextEntry ? "password" : "text"}
          value={value}
          disabled={disabled}
          onChange={(event) => onChangeText(event.currentTarget.value)}
        />
      </label>
      {right}
    </div>
  );
  TextInput.Icon = ({
    accessibilityLabel,
    onPress,
    disabled,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      aria-label={accessibilityLabel}
      onClick={onPress}
      disabled={disabled}
    />
  );
  return {
    useTheme: () => ({
      dark: false,
      colors: {
        onSurfaceVariant: "#555",
        surfaceVariant: "#eee",
        onPrimary: "#222",
        primary: "#ec8051",
      },
    }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    TextInput,
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    Checkbox: {
      Item: ({
        label,
        status,
        onPress,
        disabled,
      }: {
        label: string;
        status: string;
        onPress: () => void;
        disabled?: boolean;
      }) => (
        <button
          role="checkbox"
          aria-checked={status === "checked"}
          disabled={disabled}
          onClick={onPress}
        >
          {label}
        </button>
      ),
    },
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      buttons: Array<{ value: string; label: string; disabled?: boolean }>;
      onValueChange: (value: string) => void;
    }) => (
      <div>
        {buttons.map((button) => (
          <button
            key={button.value}
            disabled={button.disabled}
            onClick={() => onValueChange(button.value)}
          >
            {button.label}
          </button>
        ))}
      </div>
    ),
    List: {
      Item: ({
        title,
        description,
        right,
      }: {
        title: string;
        description: string;
        right: () => ReactNode;
      }) => (
        <div>
          <span>{title}</span>
          <span>{description}</span>
          {right()}
        </div>
      ),
    },
  };
});
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue(undefined);
  authenticate.mockResolvedValue(undefined);
  changePassword.mockResolvedValue(undefined);
  sessions.mockResolvedValue({ sessions: [] });
  revoke.mockResolvedValue(undefined);
  account = {
    server: "https://ledger.example",
    policy: {
      allowRegistration: true,
      minimumPasswordLength: 20,
      maximumPasswordLength: 128,
    },
    credentials: null,
    error: "",
    connect,
    authenticate,
    changePassword,
    client: { sessions, revoke },
  };
});
afterEach(cleanup);

it("prevents registration if the server closes it while the form is open", () => {
  const view = render(<AccountForm />);
  fireEvent.click(screen.getByRole("button", { name: "注册" }));
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: "synthetic-user" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "synthetic-password" },
  });
  fireEvent.change(screen.getByLabelText("确认密码"), {
    target: { value: "synthetic-password" },
  });
  account = {
    ...account,
    policy: { ...account.policy!, allowRegistration: false },
  };
  view.rerender(<AccountForm />);
  expect(
    (screen.getByRole("button", { name: "注册并登录" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(authenticate).not.toHaveBeenCalled();
});
it("uses the current server password policy while a temporary password requires change", () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: true },
      session: { id: "session" },
    },
  };
  render(<SecurityPanel />);
  expect(screen.getByText(/至少 20 位/)).toBeTruthy();
  expect(sessions).not.toHaveBeenCalled();
  expect(screen.queryByText("登录设备")).toBeNull();
});
it("does not permit a disabled password field to toggle visibility", () => {
  render(
    <PasswordInput
      label="密码"
      value="synthetic"
      onChangeText={vi.fn()}
      disabled
    />,
  );
  expect(
    (screen.getByRole("button", { name: "显示密码" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText("密码") as HTMLInputElement).type).toBe(
    "password",
  );
});
it("reloads the session list when the server changes even if the session ID is unchanged", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "same-session" },
    },
  };
  sessions.mockResolvedValue({ sessions: [] });
  const view = render(<SecurityPanel />);
  await waitFor(() => expect(sessions).toHaveBeenCalledTimes(1));
  account = { ...account, server: "https://other.example" };
  view.rerender(<SecurityPanel />);
  await waitFor(() => expect(sessions).toHaveBeenCalledTimes(2));
});

it("clears security credentials and hides the old device list when the account server changes", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "same-session" },
    },
  };
  sessions
    .mockResolvedValueOnce({
      sessions: [
        {
          id: "old-device",
          deviceName: "旧设备",
          isCurrent: false,
          expiresAt: 2000000000000,
        },
      ],
    })
    .mockResolvedValueOnce({ sessions: [] });
  const view = render(<SecurityPanel />);
  await waitFor(() => expect(screen.getByText("旧设备")).toBeTruthy());
  fireEvent.change(screen.getByLabelText("当前密码"), {
    target: { value: "synthetic-old-password" },
  });
  fireEvent.change(screen.getByLabelText("新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "显示当前密码" }));
  expect((screen.getByLabelText("当前密码") as HTMLInputElement).type).toBe(
    "text",
  );
  account = { ...account, server: "https://other.example" };
  view.rerender(<SecurityPanel />);
  expect((screen.getByLabelText("当前密码") as HTMLInputElement).value).toBe(
    "",
  );
  expect((screen.getByLabelText("新密码") as HTMLInputElement).value).toBe("");
  expect(screen.queryByText("旧设备")).toBeNull();
  expect((screen.getByLabelText("当前密码") as HTMLInputElement).type).toBe(
    "password",
  );
});

it("connects through the account adapter and preserves a failed login draft before a successful retry", async () => {
  account = { ...account, server: "", policy: null };
  const view = render(<AccountForm />);
  fireEvent.change(screen.getByLabelText("服务地址"), {
    target: { value: "https://ledger.example" },
  });
  fireEvent.click(screen.getByRole("button", { name: "连接服务" }));
  await waitFor(() =>
    expect(connect).toHaveBeenCalledWith("https://ledger.example"),
  );
  account = {
    ...account,
    server: "https://ledger.example",
    policy: {
      allowRegistration: true,
      minimumPasswordLength: 20,
      maximumPasswordLength: 128,
    },
  };
  view.rerender(<AccountForm />);
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: " synthetic-user " },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "synthetic-login-password" },
  });
  authenticate.mockRejectedValueOnce(new Error("服务暂不可用"));
  fireEvent.click(screen.getAllByRole("button", { name: "登录" }).at(-1)!);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("服务暂不可用"),
  );
  expect((screen.getByLabelText("密码") as HTMLInputElement).value).toBe(
    "synthetic-login-password",
  );
  fireEvent.click(screen.getAllByRole("button", { name: "登录" }).at(-1)!);
  await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(2));
  expect(authenticate).toHaveBeenLastCalledWith({
    username: "synthetic-user",
    password: "synthetic-login-password",
    remember: false,
    isRegister: false,
  });
  await waitFor(() =>
    expect((screen.getByLabelText("密码") as HTMLInputElement).value).toBe(""),
  );
});
it("validates matching registration passwords and uses the server registration flow", async () => {
  render(<AccountForm />);
  fireEvent.click(screen.getByRole("button", { name: "注册" }));
  expect(screen.getByText(/密码至少 20 位/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: "synthetic-user" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "synthetic-password-one" },
  });
  fireEvent.change(screen.getByLabelText("确认密码"), {
    target: { value: "synthetic-password-two" },
  });
  fireEvent.click(screen.getByRole("button", { name: "注册并登录" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("两次密码不一致"),
  );
  expect(authenticate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("确认密码"), {
    target: { value: "synthetic-password-one" },
  });
  fireEvent.click(screen.getByRole("button", { name: "注册并登录" }));
  await waitFor(() => expect(authenticate).toHaveBeenCalledOnce());
  expect(authenticate).toHaveBeenCalledWith({
    username: "synthetic-user",
    password: "synthetic-password-one",
    remember: false,
    isRegister: true,
  });
});
it("changes the temporary password only after matching confirmation", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: true },
      session: { id: "session" },
    },
  };
  render(<SecurityPanel />);
  fireEvent.change(screen.getByLabelText("当前密码"), {
    target: { value: "synthetic-temporary" },
  });
  fireEvent.change(screen.getByLabelText("新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.change(screen.getByLabelText("再次输入新密码"), {
    target: { value: "synthetic-other-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("两次新密码不一致"),
  );
  expect(changePassword).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("再次输入新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
  await waitFor(() =>
    expect(changePassword).toHaveBeenCalledWith(
      "synthetic-temporary",
      "synthetic-new-password",
    ),
  );
  expect(sessions).not.toHaveBeenCalled();
});
it("revokes the selected other device only after the current password and preserves failure feedback", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "current-session" },
    },
  };
  const current = {
    id: "current-session",
    deviceName: "本机",
    isCurrent: true,
    expiresAt: 2000000000000,
  };
  const other = {
    id: "other-session",
    deviceName: "测试设备",
    isCurrent: false,
    expiresAt: 2000000000000,
  };
  sessions
    .mockResolvedValueOnce({ sessions: [current, other] })
    .mockResolvedValueOnce({ sessions: [current] });
  revoke.mockRejectedValueOnce(new Error("撤销失败"));
  render(<SecurityPanel />);
  const button = await screen.findByRole("button", {
    name: "退出 测试设备 设备",
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("当前密码"), {
    target: { value: "synthetic-current" },
  });
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("撤销失败"),
  );
  expect(screen.getByText("测试设备")).toBeTruthy();
  fireEvent.click(button);
  await waitFor(() => expect(screen.queryByText("测试设备")).toBeNull());
  expect(revoke).toHaveBeenLastCalledWith("other-session", "synthetic-current");
  expect(screen.getByText("本机 · 当前设备")).toBeTruthy();
  expect(screen.getByText("该设备已退出。")).toBeTruthy();
});
it("toggles a password field without changing its value", () => {
  render(
    <PasswordInput label="密码" value="synthetic" onChangeText={vi.fn()} />,
  );
  const input = screen.getByLabelText("密码") as HTMLInputElement;
  expect(input.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  expect(input.type).toBe("text");
  expect(input.value).toBe("synthetic");
  fireEvent.click(screen.getByRole("button", { name: "隐藏密码" }));
  expect(input.type).toBe("password");
});

it("ignores a late old-server session response after an identity switch", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "same-session" },
    },
  };
  let finishOld: (value: {
    sessions: Array<{
      id: string;
      deviceName: string;
      isCurrent: boolean;
      expiresAt: number;
    }>;
  }) => void = () => {};
  const old = new Promise<{
    sessions: Array<{
      id: string;
      deviceName: string;
      isCurrent: boolean;
      expiresAt: number;
    }>;
  }>((resolve) => {
    finishOld = resolve;
  });
  sessions.mockReturnValueOnce(old).mockResolvedValueOnce({
    sessions: [
      {
        id: "new",
        deviceName: "新服务设备",
        isCurrent: false,
        expiresAt: 2000000000000,
      },
    ],
  });
  const view = render(<SecurityPanel />);
  await waitFor(() => expect(sessions).toHaveBeenCalledTimes(1));
  account = { ...account, server: "https://other.example" };
  view.rerender(<SecurityPanel />);
  expect(await screen.findByText("新服务设备")).toBeTruthy();
  finishOld({
    sessions: [
      {
        id: "old",
        deviceName: "旧服务设备",
        isCurrent: false,
        expiresAt: 2000000000000,
      },
    ],
  });
  await waitFor(() => expect(screen.queryByText("旧服务设备")).toBeNull());
  expect(screen.getByText("新服务设备")).toBeTruthy();
});
it("does not fetch device sessions after credentials are cleared", () => {
  account = { ...account, credentials: null };
  render(<SecurityPanel />);
  expect(sessions).not.toHaveBeenCalled();
});

it("reports a successful password change when the same user receives a new session", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: true },
      session: { id: "old-session" },
    },
  };
  let finish = (): void => {};
  changePassword.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<SecurityPanel />);
  fireEvent.change(screen.getByLabelText("当前密码"), {
    target: { value: "synthetic-old" },
  });
  fireEvent.change(screen.getByLabelText("新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.change(screen.getByLabelText("再次输入新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "new-session" },
    },
  };
  view.rerender(<SecurityPanel />);
  finish();
  await waitFor(() =>
    expect(screen.getByText("密码已更新，其他设备已退出。")).toBeTruthy(),
  );
  expect((screen.getByLabelText("当前密码") as HTMLInputElement).value).toBe(
    "",
  );
});

it("retains the password-change result when the replacement session renders afterward", async () => {
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: true },
      session: { id: "old-session" },
    },
  };
  const view = render(<SecurityPanel />);
  fireEvent.change(screen.getByLabelText("当前密码"), {
    target: { value: "synthetic-old" },
  });
  fireEvent.change(screen.getByLabelText("新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.change(screen.getByLabelText("再次输入新密码"), {
    target: { value: "synthetic-new-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "更新密码" }));
  await waitFor(() =>
    expect(screen.getByText("密码已更新，其他设备已退出。")).toBeTruthy(),
  );
  account = {
    ...account,
    credentials: {
      user: { id: "synthetic", mustChangePassword: false },
      session: { id: "new-session" },
    },
  };
  view.rerender(<SecurityPanel />);
  expect(screen.getByText("密码已更新，其他设备已退出。")).toBeTruthy();
});

it("clears login credentials when a different service is connected", async () => {
  const view = render(<AccountForm />);
  fireEvent.change(screen.getByLabelText("账号"), {
    target: { value: "synthetic-user" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "synthetic-old-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  fireEvent.change(screen.getByLabelText("服务地址"), {
    target: { value: "https://other.example" },
  });
  expect(screen.queryByLabelText("密码")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "连接服务" }));
  await waitFor(() =>
    expect(connect).toHaveBeenCalledWith("https://other.example"),
  );
  account = { ...account, server: "https://other.example" };
  view.rerender(<AccountForm />);
  expect((screen.getByLabelText("账号") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("密码") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("密码") as HTMLInputElement).type).toBe(
    "password",
  );
  expect(authenticate).not.toHaveBeenCalled();
});
