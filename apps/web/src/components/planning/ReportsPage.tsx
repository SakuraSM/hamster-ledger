import { Button } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
const MILLISECONDS_PER_DAY = 86400000;
const DATE_KEY_LENGTH = 10;
const CENTS_PER_YUAN = 100;
const YEAR_KEY_LENGTH = 4;
const MONEY_DIGITS = 2;
const MONTH_DAY_START = 5;
import { useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cycleRange,
  money,
  reportGroups,
  reportTrend,
  summarize,
  type Ledger,
} from "@hamster-ledger/core";
const COLORS = [
  "#a96140",
  "#d79161",
  "#bba061",
  "#78816a",
  "#9e8093",
  "#7c8f9b",
];
interface Props {
  ledger: Ledger;
  month: string;
}
export function ReportsPage({ ledger, month }: Props): React.JSX.Element {
  const initial = cycleRange(month, ledger.preferences?.cycleStartDay ?? 1);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(
    new Date(Date.parse(initial.end + "T00:00:00Z") - MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, DATE_KEY_LENGTH),
  );
  const [kind, setKind] = useState<"支出" | "收入">("支出");
  const [dimension, setDimension] = useState<"category" | "tag">("category");
  const records = ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.date.slice(0, DATE_KEY_LENGTH) >= start &&
      record.date.slice(0, DATE_KEY_LENGTH) <= end,
  );
  const totals = summarize(records);
  const groups = reportGroups({ records, dimension, kind });
  const chart = groups.filter((group) => group.amount > 0);
  const trend = reportTrend({ records, start, end }).map((item) => ({
    ...item,
    expense: item.expense / CENTS_PER_YUAN,
    income: item.income / CENTS_PER_YUAN,
  }));
  function selectYear(): void {
    setStart(month.slice(0, YEAR_KEY_LENGTH) + "-01-01");
    setEnd(month.slice(0, YEAR_KEY_LENGTH) + "-12-31");
  }
  return (
    <section className="planning-page">
      <div className="page-heading">
        <h1>看清钱花在哪里</h1>
        <p>查看任意时间段的收支、分类与标签。</p>
      </div>
      <div className="report-controls">
        <DateField
          label={<>开始日期</>}
          type="date"
          required
          value={start}
          onChange={(value) => value && setStart(value)}
        />
        <DateField
          label={<>结束日期</>}
          type="date"
          required
          value={end}
          onChange={(value) => value && setEnd(value)}
        />
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={selectYear}
        >
          查看全年
        </Button>
      </div>
      {start > end ? (
        <p role="alert" className="error-message">
          结束日期应晚于开始日期。
        </p>
      ) : null}
      <div className="report-summary">
        <div>
          <span>净支出</span>
          <strong>¥{money(totals.expense)}</strong>
        </div>
        <div>
          <span>收入</span>
          <strong>¥{money(totals.income)}</strong>
        </div>
        <div>
          <span>结余</span>
          <strong>¥{money(totals.net)}</strong>
        </div>
      </div>
      <div className="report-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>收支分布</h2>
            <div className="report-controls">
              <Choice
                aria-label="统计方向"
                value={kind}
                onChange={(value) =>
                  setKind(value === "收入" ? "收入" : "支出")
                }
              >
                <option>支出</option>
                <option>收入</option>
              </Choice>
              <Choice
                aria-label="统计维度"
                value={dimension}
                onChange={(value) =>
                  setDimension(value === "tag" ? "tag" : "category")
                }
              >
                <option value="category">分类</option>
                <option value="tag">标签</option>
              </Choice>
            </div>
          </div>
          <div
            className="report-chart"
            role="group"
            aria-label="收支占比图，详细金额见下方列表"
          >
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={chart.map((group) => ({
                      ...group,
                      value: group.amount / CENTS_PER_YUAN,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={95}
                  >
                    {chart.map((group, index) => (
                      <Cell
                        key={group.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      `¥${Number(value).toFixed(MONEY_DIGITS)}`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="empty-panel">这个时间段暂无数据</p>
            )}
          </div>
          {dimension === "tag" ? (
            <p className="muted">
              一笔账单可有多个标签，各标签分别统计。饼图仅显示正净支出。
            </p>
          ) : null}
          {groups.map((group) => (
            <div className="stat-row" key={group.name}>
              <span>{group.name}</span>
              <strong>¥{money(group.amount)}</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>每日收支趋势</h2>
          <div className="report-chart trend">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    String(value).slice(MONTH_DAY_START)
                  }
                />
                <YAxis width={55} />
                <Tooltip />
                <Line
                  isAnimationActive={false}
                  dataKey="expense"
                  name="支出（元）"
                  stroke="#a96140"
                  strokeWidth={MONEY_DIGITS}
                />
                <Line
                  isAnimationActive={false}
                  dataKey="income"
                  name="收入（元）"
                  stroke="#668366"
                  strokeWidth={MONEY_DIGITS}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>查看趋势明细</summary>
            {trend.map((item) => (
              <p key={item.date}>
                {item.date} · 支出 {item.expense.toFixed(MONEY_DIGITS)} · 收入{" "}
                {item.income.toFixed(MONEY_DIGITS)}
              </p>
            ))}
          </details>
        </section>
      </div>
    </section>
  );
}
