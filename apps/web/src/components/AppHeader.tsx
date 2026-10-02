import { useAuth } from "../auth/auth-context";
import { loginPath, navigateAuth } from "../platform/browser/auth-navigation";
import type { LedgerMode } from "@hamster-ledger/core";
import type { PageId } from "../app-config";
import { Icons } from "./Icons";
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const PAGE_LABELS: Record<PageId, string> = {
  overview: "总览",
  transactions: "全部账单",
  import: "导入账单",
  review: "重复核对",
  assets: "资产管理",
  calendar: "账单日历",
  budgets: "预算管理",
  reports: "收支报表",
  recurring: "周期记账",
  tools: "更多功能",
};
interface AppHeaderProps {
  bookName: string;
  onAdd: () => void;
  page: PageId;
  mode: LedgerMode;
  months: string[];
  month: string;
  onMonth: (month: string) => void;
  onSettings: () => void;
  onImport: () => void;
}
export function AppHeader({
  bookName,
  onAdd,
  page,
  mode,
  months,
  month,
  onMonth,
  onSettings,
  onImport,
}: AppHeaderProps): React.JSX.Element {
  const auth = useAuth();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button aria-label="切换账本" onClick={onSettings}>
          {bookName}
        </button>
        <span>/</span>
        <strong>{PAGE_LABELS[page]}</strong>
      </div>
      <div className="top-actions">
        <button
          className="header-account"
          onClick={() => (auth.user ? onSettings() : navigateAuth(loginPath()))}
        >
          <Icons.Shield size={19} />
          <span>{auth.user?.username ?? "登录"}</span>
        </button>
        <button className="primary-button" onClick={onAdd}>
          <Icons.Plus size={20} />
          <span>记一笔</span>
        </button>
        {page === "overview" || page === "transactions" ? (
          <label className="month-picker">
            <Icons.Calendar size={20} />
            <select
              aria-label="月份"
              value={month}
              onChange={(event) => onMonth(event.target.value)}
            >
              {page === "transactions" ? (
                <option value="">全部账期</option>
              ) : null}
              {months.map((item) => (
                <option key={item} value={item}>
                  {item.slice(0, YEAR_LENGTH)}年
                  {Number(item.slice(MONTH_START))}月
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="mode-label">
            {mode === "demo" ? "示例数据" : "我的账本"}
          </span>
        )}
        {page !== "import" ? (
          <button className="secondary-button header-import" onClick={onImport}>
            <Icons.Upload size={20} />
            <span>导入账单</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
