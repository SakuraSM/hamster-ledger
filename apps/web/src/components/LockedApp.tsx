import { TextInput, Button } from "@mantine/core";
import { useState } from "react";
import { hasVault, unlockVault } from "../platform/browser/vault";
import { App } from "../App";
export function LockedApp(): React.JSX.Element {
  const [isLocked, setIsLocked] = useState(hasVault);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  async function unlock(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    try {
      await unlockVault(password);
      setPassword("");
      setIsLocked(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "解锁失败");
    } finally {
      setIsBusy(false);
    }
  }
  if (!isLocked) return <App />;
  return (
    <main className="lock-screen">
      <img src="/assets/hamster-logo.png" alt="" width="80" />
      <h1>打开你的仓鼠账本</h1>
      <p>输入本机解锁密码</p>
      <form onSubmit={unlock}>
        <TextInput
          label={<>解锁密码</>}
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
          {isBusy ? "正在解锁…" : "解锁账本"}
        </Button>
      </form>
      <p className="muted">
        密码只在本机解密，忘记后需要从其他设备或备份恢复。
      </p>
    </main>
  );
}
