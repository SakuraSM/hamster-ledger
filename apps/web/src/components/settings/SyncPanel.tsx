import { useAuth } from "../../auth/auth-context";
import type { CloudController } from "../../hooks/useCloudSync";
import {
  loginPath,
  navigateAuth,
} from "../../platform/browser/auth-navigation";
export function SyncPanel({
  sync,
}: {
  sync: CloudController;
}): React.JSX.Element {
  const auth = useAuth();
  const run = (action: () => Promise<void>): void => {
    void action().catch(() => undefined);
  };
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
        <div className="sync-login-prompt">
          <p>当前仅在本机使用。登录后可选择需要同步的账本。</p>
          <button
            className="primary-button"
            onClick={() => navigateAuth(loginPath())}
          >
            登录并使用同步
          </button>
        </div>
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
      {auth.isOffline ? (
        <button className="text-button" onClick={() => void auth.refresh()}>
          重新连接同步服务
        </button>
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
