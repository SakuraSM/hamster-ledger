import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import {
  loginPath,
  navigateAuth,
} from "../../platform/browser/auth-navigation";
import { PasswordField } from "./PasswordField";
import { Icons } from "../Icons";
const SECOND_MS = 1000;
interface Props {
  mode: "login" | "register";
}
export function AuthForm({ mode }: Props): React.JSX.Element {
  const auth = useAuth();
  const isRegister = mode === "register";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    confirmation?: string;
  }>({});
  const [error, setError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!auth.retryAfter) {
      setCooldown(0);
      return;
    }
    const end = Date.now() + auth.retryAfter * SECOND_MS;
    setCooldown(auth.retryAfter);
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / SECOND_MS));
      setCooldown(remaining);
      if (!remaining) clearInterval(timer);
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [auth.retryAfter]);
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!/^[a-z0-9][a-z0-9_.@-]{2,63}$/i.test(username.trim()))
      errors.username = "使用 3–64 位字母、数字或 . _ @ -";
    if (!password) errors.password = "请输入密码";
    else if ([...password].length > auth.policy.maximumPasswordLength)
      errors.password =
        "密码最多 " + auth.policy.maximumPasswordLength + " 个字符";
    else if (
      isRegister &&
      [...password].length < auth.policy.minimumPasswordLength
    )
      errors.password =
        "至少 " +
        auth.policy.minimumPasswordLength +
        " 个字符，可使用空格和短语";
    if (isRegister && password !== confirmation)
      errors.confirmation = "两次输入的密码不一致";
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) return;
    try {
      await auth.authenticate({
        username: username.trim(),
        password,
        isRegister,
        remember,
      });
      setPassword("");
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请重试。");
    }
  }
  function changeMode(): void {
    setError("");
    auth.clearError();
    navigateAuth(
      loginPath(
        isRegister ? "login" : "register",
        new URLSearchParams(location.search).get("returnTo") ?? "/",
      ),
    );
  }
  return (
    <>
      <div className="auth-heading">
        <h1>{isRegister ? "创建你的账号" : "欢迎回来"}</h1>
        <p>
          {isRegister
            ? "注册后，把需要同步的账本带到其他设备。"
            : "登录仓鼠记账，接着记下生活。"}
        </p>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="auth-username">账号</label>
          <input
            id="auth-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={64}
            autoFocus
            value={username}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={
              fieldErrors.username ? "username-error" : undefined
            }
            onChange={(event) => setUsername(event.target.value)}
            placeholder="输入账号"
          />
          {fieldErrors.username ? (
            <small id="username-error" className="field-error">
              {fieldErrors.username}
            </small>
          ) : null}
        </div>
        <PasswordField
          label="密码"
          name="auth-password"
          value={password}
          onChange={setPassword}
          autoComplete={isRegister ? "new-password" : "current-password"}
          error={fieldErrors.password}
          description={
            isRegister
              ? `至少 ${auth.policy.minimumPasswordLength} 个字符，建议使用独特的长密码。`
              : undefined
          }
        />
        {isRegister ? (
          <PasswordField
            label="确认密码"
            name="auth-confirm-password"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            error={fieldErrors.confirmation}
          />
        ) : null}
        <div className="auth-options">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            记住登录 {auth.policy.rememberDays} 天
          </label>
          {!isRegister ? (
            <button
              type="button"
              className="text-button"
              aria-expanded={showRecovery}
              onClick={() => setShowRecovery(!showRecovery)}
            >
              忘记密码？
            </button>
          ) : null}
        </div>
        <p className="auth-device-note">记住登录仅适用于你的个人设备。</p>
        {showRecovery ? (
          <div className="auth-help">
            <h2>联系服务管理员重置</h2>
            <p>
              此自托管服务不通过邮件重置密码。管理员重置后，你需要使用临时密码登录并设置新密码。
            </p>
            <details>
              <summary>我是管理员</summary>
              <p>在服务器的仓库目录运行：</p>
              <code>npm run auth:reset -- --username 账号名</code>
              <p>该操作会退出这个账号的所有会话。</p>
            </details>
          </div>
        ) : null}
        {error || auth.error ? (
          <p className="error-message" role="alert">
            {error || auth.error}
          </p>
        ) : null}
        <button
          className="primary-button auth-submit"
          disabled={auth.isBusy || cooldown > 0}
        >
          {auth.isBusy
            ? "正在处理…"
            : cooldown > 0
              ? `${cooldown} 秒后重试`
              : isRegister
                ? "创建账号"
                : "登录"}
          {!auth.isBusy && !cooldown ? <Icons.Arrow size={20} /> : null}
        </button>
      </form>
      {(!isRegister && auth.policy.allowRegistration) || isRegister ? (
        <p className="auth-switch">
          {isRegister ? "已有账号？" : "还没有账号？"}
          <button className="text-button" onClick={changeMode}>
            {isRegister ? "去登录" : "创建账号"}
          </button>
        </p>
      ) : (
        <p className="auth-switch muted">
          {auth.isOffline
            ? "连接服务后可确认注册是否开放。"
            : "此服务未开放注册，请联系管理员获取账号。"}
        </p>
      )}
    </>
  );
}
