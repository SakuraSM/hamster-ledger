const PERCENT_SCALE = 100;
const MONTH_START = 5;
const CATEGORY_LIMIT = 4;
import { DailyChart } from "./DailyChart";
import {
  type BillRecord,
  type AssetAccount,
  type Category,
  money,
  summarize,
  cycleRange,
} from "@hamster-ledger/core";
import { CategoryIcon, Icons } from "./Icons";
import { TransactionTable } from "./TransactionTable";
interface OverviewProps {
  records: BillRecord[];
  accounts: AssetAccount[];
  month: string;
  isDemo: boolean;
  hideAmounts?: boolean;
  cycleStartDay?: number;
  pending: number;
  onReview: () => void;
  onAll: () => void;
  onCategory: (category: Category) => void;
  onSelect: (record: BillRecord) => void;
  onImport: () => void;
}
const MAX_RECENT_ROWS = 4;
export function Overview({
  records,
  accounts,
  month,
  isDemo,
  hideAmounts = false,
  cycleStartDay = 1,
  pending,
  onReview,
  onAll,
  onCategory,
  onSelect,
  onImport,
}: OverviewProps): React.JSX.Element {
  const totals = summarize(records);
  const range = cycleRange(month, cycleStartDay);
  const categoryTotals = new Map<Category, number>();
  records
    .filter((record) => record.kind === "支出" || record.kind === "退款")
    .forEach((record) =>
      categoryTotals.set(
        record.category,
        (categoryTotals.get(record.category) ?? 0) +
          (record.kind === "退款" ? -record.amount : record.amount),
      ),
    );
  const categories = [...categoryTotals.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, CATEGORY_LIMIT);
  const grossExpense = [...categoryTotals.values()].reduce(
    (total, amount) => total + amount,
    0,
  );
  const recent = [...records]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, MAX_RECENT_ROWS);
  const monthName = [
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
    "十一",
    "十二",
  ][Number(month.slice(MONTH_START)) - 1];
  return (
    <div className="overview-page">
      <section className="page-heading">
        <h1>{monthName}月，收支一目了然</h1>
        <p>
          账期 {range.start} 至 {range.end}（不含结束日）
        </p>
      </section>
      <section className="summary" aria-label="月度收支">
        <div className="summary-primary">
          <div className="metric-label">
            支出 <small>{isDemo ? "（示例数据）" : "（退款已抵扣）"}</small>
          </div>
          <strong>
            <span>¥</span>
            {hideAmounts ? "••••" : money(totals.expense)}
          </strong>
        </div>
        <div>
          <div className="metric-label">
            收入 <small>{isDemo ? "（示例数据）" : ""}</small>
          </div>
          <strong>
            <span>¥</span>
            {hideAmounts ? "••••" : money(totals.income)}
          </strong>
        </div>
        <div>
          <div className="metric-label">
            结余 <small>{isDemo ? "（示例数据）" : ""}</small>
          </div>
          <strong>
            <span>¥</span>
            {hideAmounts ? "••••" : money(totals.net)}
          </strong>
        </div>
      </section>
      <p className="summary-caption">已确认账单 · 转账与还款不计入收支</p>
      {pending ? (
        <button className="review-callout" onClick={onReview}>
          <Icons.Warning weight="fill" size={21} />
          <span>{pending} 组疑似重复待核对</span>
          <span className="underlined">
            去核对 <Icons.Arrow size={18} />
          </span>
        </button>
      ) : (
        <div className="review-clear">
          <Icons.Check size={19} />
          当前没有待核对的重复账单
        </div>
      )}
      {hideAmounts ? (
        <p className="empty-panel">首页金额已隐藏，可在更多功能中恢复显示。</p>
      ) : !records.length ? (
        <div className="welcome-empty">
          <Icons.Book size={48} weight="duotone" />
          <h2>从第一份账单开始</h2>
          <p>把分散的流水整理到一起，慢慢看清自己的收支。</p>
          <button className="primary-button" onClick={onImport}>
            <Icons.Upload size={20} />
            导入账单
          </button>
        </div>
      ) : (
        <>
          <section className="analytics">
            <div className="trend-section">
              <h2>
                支出趋势 <small>{isDemo ? "（示例数据）" : ""}</small>
              </h2>
              <DailyChart
                records={records}
                month={month}
                cycleStartDay={cycleStartDay}
              />
            </div>
            <div className="category-section">
              <div className="section-heading">
                <h2>
                  支出分类 <small>{isDemo ? "（示例数据）" : ""}</small>
                </h2>
                <span>金额占比</span>
              </div>
              <div className="category-list">
                {categories.map(([category, amount], index) => (
                  <button
                    key={category}
                    className="category-row"
                    onClick={() => onCategory(category)}
                  >
                    <span className="category-circle">
                      <CategoryIcon category={category} />
                    </span>
                    <span>{category}</span>
                    <progress
                      max={categories[0][1]}
                      value={amount}
                      className={index === 0 ? "leading" : ""}
                      aria-label={`${category}占比`}
                    />
                    <span className="category-amount">¥ {money(amount)}</span>
                    <span className="category-percent">
                      {((amount / grossExpense) * PERCENT_SCALE).toFixed(1)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="recent-section">
            <div className="section-heading">
              <h2>
                最近账单 <small>{isDemo ? "（示例数据）" : ""}</small>
              </h2>
              <button className="text-button" onClick={onAll}>
                查看全部 <Icons.Arrow size={18} />
              </button>
            </div>
            <TransactionTable
              accounts={accounts}
              records={recent}
              onSelect={onSelect}
            />
          </section>
        </>
      )}
    </div>
  );
}
