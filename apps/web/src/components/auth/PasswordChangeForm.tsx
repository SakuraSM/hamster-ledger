import { useState } from "react";
import { useAuth } from "../../auth/auth-context";
import { PasswordField } from "./PasswordField";
export function PasswordChangeForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}): React.JSX.Element {
  const auth = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setMessage("");
    setError("");
    if (newPassword !== confirmation) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (
      [...newPassword].length < auth.policy.minimumPasswordLength ||
      [...newPassword].length > auth.policy.maximumPasswordLength
    ) {
      setError(
        `新密码需为 ${auth.policy.minimumPasswordLength}–${auth.policy.maximumPasswordLength} 个字符。`,
      );
      return;
    }
    try {
      await auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage("密码已更改，其他设备已退出登录。");
      onSuccess?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "密码修改失败。");
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <PasswordField
        label="当前密码"
        name="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
      />
      <PasswordField
        label="新密码"
        name="new-password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        description={`至少 ${auth.policy.minimumPasswordLength} 个字符，支持空格和短语。`}
      />
      <PasswordField
        label="确认新密码"
        name="confirm-new-password"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />
      <p className="muted">更改密码后，其他设备需要重新登录。</p>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <button className="primary-button" disabled={auth.isBusy}>
        {auth.isBusy ? "保存中…" : "更新密码"}
      </button>
    </form>
  );
}
