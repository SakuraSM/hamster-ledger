import { DesktopAuthScene } from "./DesktopAuthScene";
import { isAuthScene, bookName, storageLabel } from "./view-context";
const PENDING_COUNTS = { before: 3, afterConfirmation: 2 };
import { useSceneConfirmation } from "./useSceneConfirmation";
import { AssetContextRail } from "./AssetContextRail";
import { DesignIcon } from "./icons";
import { LOGO, type SceneBodyProps, type IconName } from "./model";
import { SceneActions, SceneBody } from "./SceneShell";
const DESKTOP_NAV: Array<{ label: string; icon: IconName; target: string }> = [
  { label: "待处理", icon: "receipt", target: "inbox" },
  { label: "总览", icon: "chart", target: "overview" },
  { label: "全部账单", icon: "book", target: "transactions" },
  { label: "资产账户", icon: "wallet", target: "assets" },
  { label: "预算与计划", icon: "target", target: "budgets" },
  { label: "账单日历", icon: "calendar", target: "calendar" },
  { label: "导入账单", icon: "upload", target: "import" },
];
function ContextRail({ scene, onNavigate }: SceneBodyProps): React.JSX.Element {
  const expense = scene.id === "confirmed" ? "¥1,304.40" : "¥1,286.40";
  const remaining = scene.id === "confirmed" ? "¥3,695.60" : "¥3,713.60";
  return (
    <aside className="context-rail">
      <span className="rail-eyebrow">{bookName(scene)} · 2026年11月</span>
      <h2>每次确认，都有依据。</h2>
      <div className="rail-total">
        <small>已确认净支出</small>
        <strong>{expense}</strong>
      </div>
      <dl>
        <div>
          <dt>本期收入</dt>
          <dd>¥8,500.00</dd>
        </div>
        <div>
          <dt>预算余量</dt>
          <dd>{remaining}</dd>
        </div>
      </dl>
      <div className="rail-note">
        <DesignIcon name="shield" size={22} />
        <p>
          {scene.id === "inbox"
            ? "当前草稿尚未入账，确认后才会影响这里的统计。"
            : "只汇总已确认账单。转账与还款不计收入或支出。"}
        </p>
      </div>
      <div className="rail-links">
        <button type="button" onClick={() => onNavigate("backup")}>
          <DesignIcon name="lock" />
          备份与恢复
          <DesignIcon name="chevron" size={15} />
        </button>
        <button type="button" onClick={() => onNavigate("books")}>
          <DesignIcon name="users" />
          切换账本
          <DesignIcon name="chevron" size={15} />
        </button>
      </div>
    </aside>
  );
}
function DesktopLedgerScene(props: SceneBodyProps): React.JSX.Element {
  const { scene, onNavigate } = props;
  const confirmation = useSceneConfirmation(scene);
  return (
    <section
      className={`design-scene desktop-scene ${scene.layout ?? "standard"}-layout ${scene.night ? "night-theme" : ""}`}
      onChange={confirmation.onFormChange}
      data-scene={scene.id}
      aria-label={`${scene.title}桌面视觉稿`}
    >
      <aside className="desktop-sidebar">
        <button
          type="button"
          className="desktop-brand"
          onClick={() => onNavigate("overview")}
        >
          <img src={LOGO} alt="仓鼠记账" />
          <span>
            仓鼠记账<small>把每一笔，存进小日子</small>
          </span>
        </button>
        <button
          type="button"
          className="book-switch"
          onClick={() => onNavigate("books")}
        >
          <DesignIcon name="book" />
          {bookName(scene)} <small>示例</small>
          <DesignIcon name="chevron" size={15} />
        </button>
        <nav aria-label="应用主导航">
          {DESKTOP_NAV.map((item) => (
            <button
              type="button"
              key={item.target}
              className={scene.id === item.target ? "active" : ""}
              onClick={() => onNavigate(item.target)}
            >
              <DesignIcon name={item.icon} />
              {item.label}
              {item.target === "inbox" ? (
                <small>
                  {scene.id === "confirmed"
                    ? PENDING_COUNTS.afterConfirmation
                    : PENDING_COUNTS.before}
                </small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" onClick={() => onNavigate("tools")}>
            <DesignIcon name="settings" />
            工具与设置
          </button>
          <button type="button" onClick={() => onNavigate("sessions")}>
            <DesignIcon name="users" />
            示例用户
          </button>
          <p>
            <DesignIcon name="lock" size={13} />
            {storageLabel(scene)}
          </p>
        </div>
      </aside>
      <div className="desktop-workspace">
        <header className="desktop-toolbar">
          <span>
            {bookName(scene)} <span className="toolbar-slash">/</span>{" "}
            {scene.group}
          </span>
          <div>
            <button
              type="button"
              className="search-shortcut"
              onClick={() => onNavigate("filters")}
            >
              <DesignIcon name="search" size={17} />
              搜索账单<span>⌘ K</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="通知中心"
              onClick={() => onNavigate("notifications")}
            >
              <DesignIcon name="bell" />
            </button>
            <button
              type="button"
              className="small-primary"
              onClick={() => onNavigate("entry")}
            >
              <DesignIcon name="plus" size={18} />
              记一笔
            </button>
          </div>
        </header>
        <div className="desktop-columns">
          <main className="desktop-main">
            <SceneBody {...props} />
            <SceneActions {...props} canProceed={confirmation.canProceed} />
          </main>
          {scene.group === "资产与报表" ? (
            <AssetContextRail {...props} />
          ) : (
            <ContextRail {...props} />
          )}
        </div>
      </div>
    </section>
  );
}

export function DesktopScene(props: SceneBodyProps): React.JSX.Element {
  return isAuthScene(props.scene) ? (
    <DesktopAuthScene {...props} />
  ) : (
    <DesktopLedgerScene {...props} />
  );
}
