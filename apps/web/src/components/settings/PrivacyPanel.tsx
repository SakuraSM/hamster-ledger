import { useState } from "react";
import { enableVault, hasVault, lockVault } from "../../platform/browser/vault";
export function PrivacyPanel(): React.JSX.Element {
  const [isEnabled, setIsEnabled] = useState(hasVault);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function enable(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (password !== confirmation) throw new Error("两次密码不一致。");
      await enableVault(password);
      setIsEnabled(true);
      setPassword("");
      setConfirmation("");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "加密失败，原数据保留。",
      );
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <section className="panel">
      <h2>本机密码保护</h2>
      {isEnabled ? (
        <>
          <p>本机账本已加密保存。关闭页面后再次打开需要解锁。</p>
          <button className="secondary-button" onClick={() => void lockVault()}>
            立即锁定
          </button>
        </>
      ) : (
        <form onSubmit={enable}>
          <p className="muted">
            为本浏览器的所有账本设置解锁密码。忘记密码无法直接找回，请先导出备份。云端账号使用独立密码。
          </p>
          <div className="form-grid">
            <label>
              解锁密码
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              再次输入
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </div>
          <button className="secondary-button" disabled={isSaving}>
            启用加密保护
          </button>
        </form>
      )}
      {error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : null}
    </section>
  );
}
