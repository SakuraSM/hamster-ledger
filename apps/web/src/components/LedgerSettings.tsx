const BACKUP_INDENT = 2;
import type { Ledger, LedgerMode } from "@hamster-ledger/core";
import { Dialog } from "./Dialog";
import { Icons } from "./Icons";
import { downloadFile } from "../platform/browser/downloads";
interface LedgerSettingsProps {
  mode: LedgerMode;
  ledger: Ledger;
  onSwitch: (mode: LedgerMode) => void;
  onClose: () => void;
}
export function LedgerSettings({
  mode,
  ledger,
  onSwitch,
  onClose,
}: LedgerSettingsProps): React.JSX.Element {
  function handleBackup(): void {
    downloadFile({
      name: `仓鼠记账-${mode === "demo" ? "示例" : "我的账本"}-备份.json`,
      text: JSON.stringify(ledger, null, BACKUP_INDENT),
      type: "application/json",
    });
  }
  return (
    <Dialog title="我的账本" onClose={onClose}>
      <p className="muted">示例账本用于体验，真实账单请导入我的账本。</p>
      <div className="ledger-options">
        <button
          className={mode === "demo" ? "selected" : ""}
          onClick={() => {
            onSwitch("demo");
            onClose();
          }}
        >
          <Icons.Book size={26} weight="duotone" />
          <span>
            <strong>示例账本</strong>
            <small>用虚拟数据体验完整流程</small>
          </span>
          {mode === "demo" ? <Icons.Check size={21} /> : null}
        </button>
        <button
          className={mode === "personal" ? "selected" : ""}
          onClick={() => {
            onSwitch("personal");
            onClose();
          }}
        >
          <Icons.Wallet size={26} weight="duotone" />
          <span>
            <strong>我的账本</strong>
            <small>只包含你导入的记录</small>
          </span>
          {mode === "personal" ? <Icons.Check size={21} /> : null}
        </button>
      </div>
      <div className="settings-note">
        <h3>数据保存在当前浏览器</h3>
        <p>
          清理网站数据、换浏览器或设备后，这里的账本不会自动同步。建议定期导出备份。当前版本支持导出，备份恢复尚未提供。
        </p>
        <button className="secondary-button" onClick={handleBackup}>
          <Icons.Download size={19} />
          导出完整备份
        </button>
      </div>
      <div className="settings-note">
        <h3>已记住的分类规则</h3>
        {Object.entries(ledger.rules).length ? (
          <ul>
            {Object.entries(ledger.rules).map(([merchant, category]) => (
              <li key={merchant}>
                {merchant} → {category}
              </li>
            ))}
          </ul>
        ) : (
          <p>在账单详情中修改分类，并勾选“记住分类”即可添加。</p>
        )}
      </div>
    </Dialog>
  );
}
