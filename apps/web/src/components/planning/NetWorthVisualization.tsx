import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatChartTick,
  money,
  netWorthGapDescription,
} from "@hamster-ledger/core";

const MINOR_PER_YUAN = 100;
const MONEY_PRECISION = 2;
const DOMAIN_PADDING = 0.15;
const FLAT_PADDING = 0.01;
const MINIMUM_PADDING_YUAN = 1;
const MIN_COMPARISON_POINTS = 2;
const MONTH_DAY_OFFSET = 5;
interface NetWorthRow {
  date: string;
  amount: number | null;
  missing: string[];
  missingBaselines?: string[];
}
interface NetWorthVisualizationProps {
  rows: NetWorthRow[];
  isHidden: boolean;
  hasAccounts: boolean;
}
function periodChange(rows: NetWorthRow[]): string {
  const first = rows[0]?.amount;
  const last = rows[rows.length - 1]?.amount;
  if (rows.length < MIN_COMPARISON_POINTS || first == null || last == null)
    return "起止估值齐全后显示区间变化";
  const difference = BigInt(last) - BigInt(first);
  if (
    difference > BigInt(Number.MAX_SAFE_INTEGER) ||
    difference < -BigInt(Number.MAX_SAFE_INTEGER)
  )
    return "区间变化超出显示范围";
  const change = Number(difference);
  return change === 0
    ? "区间持平"
    : `区间${change > 0 ? "净增" : "净减"} ¥${money(Math.abs(change))}`;
}
export function NetWorthVisualization({
  rows,
  isHidden,
  hasAccounts,
}: NetWorthVisualizationProps): React.JSX.Element {
  const [selectedDate, setSelectedDate] = useState("");
  const gradientId = `worth-${useId().replace(/:/g, "")}`;
  const requested = rows.findIndex((row) => row.date === selectedDate);
  const index = requested < 0 ? rows.length - 1 : requested;
  const selected = rows[index];
  const hasValues = rows.some((row) => row.amount !== null);
  const values = rows.flatMap((row) =>
    row.amount === null ? [] : [row.amount / MINOR_PER_YUAN],
  );
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const padding = Math.max(
    (maximum - minimum) * DOMAIN_PADDING,
    Math.max(Math.abs(minimum), Math.abs(maximum)) * FLAT_PADDING,
    MINIMUM_PADDING_YUAN,
  );
  const domain = values.length
    ? [minimum - padding, maximum + padding]
    : [0, 1];
  if (isHidden)
    return (
      <p className="empty-panel">金额已隐藏，净资产趋势与明细暂不展示。</p>
    );
  if (!hasAccounts)
    return (
      <p className="empty-panel">
        添加账户并设置余额基准后，即可查看净资产趋势。
      </p>
    );
  if (!selected)
    return <p className="empty-panel">所选范围没有可展示的估值日期。</p>;
  return (
    <>
      <div className="net-worth-selection" aria-live="polite">
        <span>{selected.date} · 净资产</span>
        <strong>
          {selected.amount === null ? "暂无估值" : `¥${money(selected.amount)}`}
        </strong>
        <small>
          {selected.amount === null
            ? netWorthGapDescription(selected)
            : periodChange(rows)}
        </small>
      </div>
      {hasValues ? (
        <div
          className="asset-trend-chart"
          role="group"
          aria-label="净资产趋势，可用下方按钮选择估值日期"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows.map((row) => ({
                ...row,
                value: row.amount === null ? null : row.amount / MINOR_PER_YUAN,
              }))}
              margin={{ top: 12, right: 18, bottom: 4, left: 4 }}
              onClick={(state) => {
                if (state?.activeLabel !== undefined)
                  setSelectedDate(String(state.activeLabel));
              }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--positive)"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--positive)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickFormatter={(date: string) =>
                  date.slice(MONTH_DAY_OFFSET).replace("-", ".")
                }
                minTickGap={30}
              />
              <YAxis
                width={72}
                domain={domain}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickFormatter={(value: number) =>
                  formatChartTick(value * MINOR_PER_YUAN)
                }
              />
              <Tooltip
                formatter={(value) =>
                  `¥${Number(value).toFixed(MONEY_PRECISION)}`
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                name="净资产"
                stroke="var(--positive)"
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty-panel">
          所选范围内没有完整估值，缺少的数据不会按零计算。
        </p>
      )}
      <div className="net-worth-controls">
        <button
          type="button"
          disabled={index <= 0}
          aria-label="查看上一期净资产"
          onClick={() => setSelectedDate(rows[index - 1].date)}
        >
          上一期
        </button>
        <span>
          {index + 1} / {rows.length}
        </span>
        <button
          type="button"
          disabled={index >= rows.length - 1}
          aria-label="查看下一期净资产"
          onClick={() => setSelectedDate(rows[index + 1].date)}
        >
          下一期
        </button>
      </div>
      <details className="net-worth-details">
        <summary>查看估值明细</summary>
        {rows.map((row) => (
          <p key={row.date}>
            {row.date} ·{" "}
            {row.amount === null
              ? netWorthGapDescription(row)
              : `¥${money(row.amount)}`}
          </p>
        ))}
      </details>
    </>
  );
}
