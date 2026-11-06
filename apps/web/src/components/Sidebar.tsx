import { UnstyledButton } from "@mantine/core";
import { type PageId } from "../app-config";
const PRIMARY_SOURCE_COUNT = 3;
import { Icons, SourceIcon } from "./Icons";
import { SOURCES, type Source, type LedgerMode } from "@hamster-ledger/core";
const NAV_ITEMS = [
  { id: "inbox", label: "待处理", icon: Icons.Receipt },
  { id: "overview", label: "总览", icon: Icons.House },
  { id: "transactions", label: "全部账单", icon: Icons.List },
  { id: "assets", label: "资产管理", icon: Icons.Wallet },
  { id: "budgets", label: "预算管理", icon: Icons.Wallet },
  { id: "calendar", label: "账单日历", icon: Icons.Calendar },
  { id: "import", label: "导入账单", icon: Icons.Upload },
  { id: "reports", label: "收支报表", icon: Icons.Chart },
  { id: "recurring", label: "周期记账", icon: Icons.Undo },
  { id: "review", label: "重复核对", icon: Icons.Link },
  { id: "tools", label: "更多功能", icon: Icons.Settings },
] as const;
interface SidebarProps {
  bookName: string;
  isNetwork?: boolean;
  page: PageId;
  pending: number;
  mode: LedgerMode;
  onNavigate: (page: PageId) => void;
  onSource: (source: Source) => void;
  onSettings: () => void;
}
export function Sidebar({
  bookName,
  isNetwork,
  mode,
  page,
  pending,
  onNavigate,
  onSource,
  onSettings,
}: SidebarProps): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/assets/hamster-logo.png" alt="" width="48" height="48" />
        <div>
          <strong>仓鼠记账</strong>
          <span>把每一笔，存进小日子</span>
        </div>
      </div>
      <UnstyledButton
        type="button"
        className="sidebar-book"
        aria-label={`切换账本：${bookName}`}
        onClick={onSettings}
      >
        <Icons.Book size={21} />
        <strong>{bookName}</strong>
        <small>{mode === "demo" ? "示例" : "账本"}</small>
        <Icons.Caret size={15} />
      </UnstyledButton>
      <nav className="main-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <UnstyledButton
            type="submit"
            key={id}
            aria-label={label}
            onClick={() => onNavigate(id)}
            className={`${page === id ? "nav-item active" : "nav-item"} ${["inbox", "transactions", "assets"].includes(id) ? "" : "desktop-nav"} ${["transactions", "assets"].includes(id) ? "has-mobile-label" : ""}`}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon size={25} weight={page === id ? "fill" : "regular"} />
            <span className="nav-label">{label}</span>
            {id === "transactions" || id === "assets" ? (
              <span className="nav-mobile-label">
                {id === "transactions" ? "账单" : "资产"}
              </span>
            ) : null}
            {id === "inbox" && pending > 0 ? (
              <span className="count-badge">{pending}</span>
            ) : null}
          </UnstyledButton>
        ))}
      </nav>
      <div className="source-nav">
        <p>账单来源</p>
        {SOURCES.slice(0, PRIMARY_SOURCE_COUNT).map((source) => (
          <UnstyledButton
            type="submit"
            key={source}
            onClick={() => onSource(source)}
          >
            <SourceIcon source={source} />
            <span>{source}</span>
          </UnstyledButton>
        ))}
      </div>
      <div className="sidebar-footer">
        <UnstyledButton type="submit" onClick={onSettings}>
          <Icons.Settings size={23} />
          <span>工具与设置</span>
          <Icons.Caret size={18} />
        </UnstyledButton>
        <p>
          {isNetwork ? "联网账本 · 本机保留只读缓存" : "账单保存在此浏览器"}
        </p>
      </div>
    </aside>
  );
}
