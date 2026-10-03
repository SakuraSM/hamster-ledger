import { Button } from "@mantine/core";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { cloud } from "../../platform/browser/cloud";
import type { DeviceSession } from "../../platform/browser/auth-model";
import { Dialog } from "../Dialog";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { PasswordField } from "./PasswordField";
const dateLabel = (value: number): string =>
  new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export function AccountSecurityPanel(): React.JSX.Element | null {
  const auth = useAuth();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<
    DeviceSession | "others" | null
  >(null);
  async function load(): Promise<void> {
    if (!auth.user) return;
    setIsLoading(true);
    try {
      setSessions((await cloud.sessions(auth.user.id)).sessions);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取会话失败。");
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    if (!auth.user) {
      setSessions([]);
      return;
    }
    setIsLoading(true);
    void cloud
      .sessions(auth.user.id)
      .then((result) => {
        if (!cancelled) setSessions(result.sessions);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "读取会话失败。");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.user?.id, auth.session?.id]);
  if (!auth.user) return null;
  const userId = auth.user.id;
  return (
    <section className="panel account-security">
      <div className="section-heading">
        <h2>账号安全</h2>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={() => setShowPassword(true)}
        >
          修改登录密码
        </Button>
      </div>
      <p className="muted">
        当前账号：{auth.user.username}。登录密码与本机解锁密码互相独立。
      </p>
      <div className="section-heading">
        <h3>登录设备</h3>
        <Button
          variant="subtle"
          type="submit"
          className="text-button"
          disabled={isLoading}
          onClick={() => void load()}
        >
          刷新
        </Button>
      </div>
      {isLoading ? <p role="status">正在读取登录设备…</p> : null}
      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <div>
              <strong>
                {session.deviceName}
                {session.isCurrent ? " · 当前会话" : ""}
              </strong>
              <span>最近活动 {dateLabel(session.lastSeenAt)}</span>
              <small>
                创建于 {dateLabel(session.createdAt)} ·{" "}
                {session.remember ? "已记住登录" : "临时会话"}
              </small>
            </div>
            {!session.isCurrent ? (
              <Button
                variant="outline"
                type="submit"
                className="secondary-button"
                onClick={() => setRevokeTarget(session)}
              >
                退出此设备
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        variant="subtle"
        type="submit"
        className="text-button"
        disabled={!sessions.some((session) => !session.isCurrent)}
        onClick={() => setRevokeTarget("others")}
      >
        退出其他所有设备
      </Button>
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : null}
      {showPassword ? (
        <Dialog title="修改登录密码" onClose={() => setShowPassword(false)}>
          <PasswordChangeForm onSuccess={() => void load()} />
        </Dialog>
      ) : null}
      {revokeTarget ? (
        <RevokeDialog
          target={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onConfirm={async (password) => {
            if (revokeTarget === "others")
              await cloud.revokeOthers(password, userId);
            else
              await cloud.revokeSession(
                { id: revokeTarget.id, currentPassword: password },
                userId,
              );
            setRevokeTarget(null);
            setMessage("所选会话已退出，需要重新登录才能同步。");
            await load();
          }}
        />
      ) : null}
    </section>
  );
}
function RevokeDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: DeviceSession | "others";
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}): React.JSX.Element {
  const [password, setPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    try {
      await onConfirm(password);
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败。");
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <Dialog
      title={target === "others" ? "退出其他所有设备" : "退出此设备"}
      onClose={onClose}
    >
      <form className="auth-form" onSubmit={submit}>
        <p>输入当前登录密码确认。本机账本不受影响。</p>
        <PasswordField
          label="当前密码"
          name="revoke-password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error ? (
          <p role="alert" className="error-message">
            {error}
          </p>
        ) : null}
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          disabled={isBusy}
        >
          {isBusy ? "处理中…" : "确认退出"}
        </Button>
      </form>
    </Dialog>
  );
}
