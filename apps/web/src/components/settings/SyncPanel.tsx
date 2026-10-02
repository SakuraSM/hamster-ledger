import { useState } from "react";
import type { CloudController } from "../../hooks/useCloudSync";
export function SyncPanel({
  sync,
}: {
  sync: CloudController;
}): React.JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const run = (action: () => Promise<void>): void => {
    void action().catch(() => undefined);
  };
  async function login(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    try {
      await sync.authenticate({ username, password, isRegister });
      setPassword("");
    } catch {
      /* Error is shown through the sync controller. */
    }
  }
  return (
    <section className="panel sync-panel">
      <h2>账号与云端同步</h2>
      {sync.user ? (
        <>
          <div className="section-heading">
            <p>已登录 {sync.user.username}</p>
            <button
              className="text-button"
              disabled={sync.isBusy}
              onClick={() => run(sync.logout)}
            >
              退出账号
            </button>
          </div>
          <p className="muted">
            {sync.isLinked
              ? "此账本已连接，页面打开时自动同步。"
              : "此账本仅保存在本机，上传后建立同步连接。"}
            云端副本保存在你部署的服务器。
          </p>
          <div className="button-row">
            {sync.isLinked ? (
              <>
                <button
                  className="secondary-button"
                  disabled={sync.isBusy}
                  onClick={() => run(sync.sync)}
                >
                  立即同步
                </button>
                <button
                  className="text-button"
                  disabled={sync.isBusy}
                  onClick={() => run(sync.disconnect)}
                >
                  断开同步
                </button>
              </>
            ) : (
              <button
                className="primary-button"
                disabled={sync.isBusy}
                onClick={() => run(sync.upload)}
              >
                上传当前账本并同步
              </button>
            )}
          </div>
          <h3>云端账本</h3>
          {sync.books.map((book) => (
            <div className="stat-row" key={book.id}>
              <span>
                {book.name}
                <small> · 版本 {book.revision}</small>
              </span>
              <button
                className="text-button"
                disabled={sync.isBusy}
                onClick={() => run(() => sync.inspect(book.id))}
              >
                查看与恢复
              </button>
            </div>
          ))}
          {!sync.books.length ? (
            <p className="muted">还没有云端账本。</p>
          ) : null}
        </>
      ) : (
        <form onSubmit={login}>
          <p className="muted">
            连接自托管服务后，可在多台设备间同步。账号独立于本机解锁密码。
          </p>
          <div className="form-grid">
            <label>
              账号
              <input
                required
                minLength={3}
                maxLength={64}
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="字母、数字或邮箱"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                required
                minLength={12}
                maxLength={256}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 12 位"
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-button" disabled={sync.isBusy}>
              {isRegister ? "注册并登录" : "登录"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? "已有账号，去登录" : "创建账号"}
            </button>
          </div>
        </form>
      )}
      {sync.preview ? (
        <div className="restore-preview">
          <h3>云端版本预览 · {sync.preview.name}</h3>
          <p>
            版本 {sync.preview.revision} ·{" "}
            {
              sync.preview.ledger.records.filter((record) => !record.isDeleted)
                .length
            }{" "}
            笔账单 · {sync.preview.ledger.accounts.length} 个账户
          </p>
          <p>恢复到新账本，保留当前本机版本。</p>
          <div className="button-row">
            <button
              className="primary-button"
              disabled={sync.isBusy}
              onClick={() => run(sync.restore)}
            >
              恢复为新账本并同步
            </button>
            <button className="text-button" onClick={sync.dismissPreview}>
              关闭预览
            </button>
          </div>
        </div>
      ) : null}
      {sync.error ? (
        <p role="alert" className="error-message">
          {sync.error}
        </p>
      ) : null}
      {sync.message ? (
        <p role="status" className="muted">
          {sync.message}
        </p>
      ) : null}
    </section>
  );
}
