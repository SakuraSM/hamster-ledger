import { UnstyledButton, Button } from "@mantine/core";
import { Choice } from "../ui/Choice";
import { useAuth } from "../auth/auth-context";
import { loginPath, navigateAuth } from "../platform/browser/auth-navigation";
import type { LedgerMode } from "@hamster-ledger/core";
import type { PageId } from "../app-config";
import { Icons } from "./Icons";
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const PAGE_LABELS: Record<PageId, string> = {
  inbox: "待处理",
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
  onBooks: () => void;
  onAccount: () => void;
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
  onBooks,
  onAccount,
  onImport,
}: AppHeaderProps): React.JSX.Element {
  const auth = useAuth();
  return (
    <header className="topbar">
      <UnstyledButton
        type="button"
        className="mobile-brand"
        aria-label={`切换账本：${bookName}`}
        onClick={onBooks}
      >
        <img src="/assets/hamster-logo.png" alt="" />
        <span>
          <b>仓鼠记账</b>
          <small>{bookName}</small>
        </span>
      </UnstyledButton>
      <div className="breadcrumb">
        <UnstyledButton type="submit" aria-label="切换账本" onClick={onBooks}>
          {bookName}
        </UnstyledButton>
        <span>/</span>
        <strong>{PAGE_LABELS[page]}</strong>
      </div>
      <div className="top-actions">
        <UnstyledButton
          type="submit"
          className="header-account"
          aria-label={auth.user ? `账号 ${auth.user.username}` : "登录账号"}
          onClick={() => (auth.user ? onAccount() : navigateAuth(loginPath()))}
        >
          <Icons.Shield size={19} />
          <span>{auth.user?.username ?? "登录"}</span>
        </UnstyledButton>
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          aria-label="记一笔"
          onClick={onAdd}
        >
          <Icons.Plus size={20} />
          <span className="primary-label">记一笔</span>
        </Button>
        {page === "overview" || page === "transactions" ? (
          <label className="month-picker">
            <Icons.Calendar size={20} />
            <Choice
              aria-label="月份"
              value={month}
              onChange={(value) => onMonth(value)}
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
            </Choice>
          </label>
        ) : (
          <span className="mode-label">
            {mode === "demo" ? "示例数据" : "我的账本"}
          </span>
        )}
        {page !== "import" ? (
          <Button
            variant="outline"
            type="submit"
            className="secondary-button header-import"
            onClick={onImport}
          >
            <Icons.Upload size={20} />
            <span>导入账单</span>
          </Button>
        ) : null}
        <UnstyledButton
          type="button"
          className="mobile-tools"
          aria-label="工具与设置"
          onClick={onSettings}
        >
          <Icons.Book size={24} />
        </UnstyledButton>
      </div>
    </header>
  );
}
