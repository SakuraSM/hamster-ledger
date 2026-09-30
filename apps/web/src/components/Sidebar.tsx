import { type PageId } from "../app-config";
const PRIMARY_SOURCE_COUNT = 3;
import { Icons, SourceIcon } from "./Icons";
import { SOURCES, type Source, type LedgerMode } from "@hamster-ledger/core";
const NAV_ITEMS = [
  { id: "overview", label: "总览", icon: Icons.House },
  { id: "transactions", label: "全部账单", icon: Icons.List },
  { id: "import", label: "导入账单", icon: Icons.Upload },
  { id: "review", label: "重复核对", icon: Icons.Link },
] as const;
interface SidebarProps {
  page: PageId;
  pending: number;
  mode: LedgerMode;
  onNavigate: (page: PageId) => void;
  onSource: (source: Source) => void;
  onSettings: () => void;
}
export function Sidebar({
  page,
  pending,
  mode,
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
      <nav className="main-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-label={label}
            onClick={() => onNavigate(id)}
            className={page === id ? "nav-item active" : "nav-item"}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon size={25} weight={page === id ? "fill" : "regular"} />
            <span>{label}</span>
            {id === "review" && pending > 0 ? (
              <span className="count-badge">{pending}</span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="source-nav">
        <p>账单来源</p>
        {SOURCES.slice(0, PRIMARY_SOURCE_COUNT).map((source) => (
          <button key={source} onClick={() => onSource(source)}>
            <SourceIcon source={source} />
            <span>{source}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button onClick={onSettings}>
          <Icons.Book size={25} />
          <span>{mode === "demo" ? "示例账本" : "我的账本"}</span>
          <Icons.Caret size={18} />
        </button>
        <p>账单保存在此浏览器</p>
      </div>
    </aside>
  );
}
