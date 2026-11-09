import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cashFlowBucketRecords,
  cashFlowBuckets,
  formatChartTick,
  money,
  type BillRecord,
} from "@hamster-ledger/core";
import { ReportRecordList } from "./ReportRecordList";

const CENTS_PER_YUAN = 100;
const MONEY_DIGITS = 2;
const MONTH_DAY_OFFSET = 5;
const SHORT_YEAR_OFFSET = 2;
const BAR_CORNER_RADIUS = 3;
interface CashFlowChartProps {
  records: BillRecord[];
  start: string;
  end: string;
  isHidden: boolean;
  onRecord?: (record: BillRecord) => void;
}
export function CashFlowChart({
  records,
  start,
  end,
  isHidden,
  onRecord,
}: CashFlowChartProps): React.JSX.Element {
  const [selectedDate, setSelectedDate] = useState("");
  const { rows, granularity, isRangeTooLarge } = useMemo(
    () => cashFlowBuckets({ records, start, end }),
    [records, start, end],
  );
  const requestedIndex = rows.findIndex((row) => row.date === selectedDate);
  const selectedIndex = requestedIndex < 0 ? rows.length - 1 : requestedIndex;
  const selected = rows[selectedIndex];
  const hasValues = rows.some((row) => row.expense !== 0 || row.income !== 0);
  const entries = useMemo(
    () =>
      selected
        ? cashFlowBucketRecords({ records, date: selected.date, start, end })
        : [],
    [records, selected, start, end],
  );
  const data = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        expense: row.expense / CENTS_PER_YUAN,
        income: row.income / CENTS_PER_YUAN,
      })),
    [rows],
  );
  const label = granularity === "month" ? "按月" : "按日";
  if (isHidden)
    return <p className="empty-panel">金额已隐藏，趋势图与明细暂不展示。</p>;
  if (isRangeTooLarge)
    return (
      <p className="empty-panel">
        时间范围涉及超过 120 个自然月，请缩短后查看趋势。
      </p>
    );
  if (!rows.length)
    return <p className="empty-panel">请选择有效的时间范围。</p>;
  return (
    <>
      <div className="cashflow-heading">
        <span>{label} · 退款抵减支出</span>
        <span>
          <i className="income-dot" />
          收入 <i className="expense-dot" />
          净支出
        </span>
      </div>
      {!hasValues ? (
        <p className="empty-panel">该范围的收入和净支出均为零。</p>
      ) : (
        <div
          className="report-chart trend"
          role="group"
          aria-label={`${label}收支趋势，可用下方按钮选择日期`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              onClick={(state) => {
                if (state?.activeLabel !== undefined)
                  setSelectedDate(String(state.activeLabel));
              }}
            >
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
                tickFormatter={(value: string) =>
                  granularity === "day"
                    ? value.slice(MONTH_DAY_OFFSET).replace("-", ".")
                    : value.slice(SHORT_YEAR_OFFSET).replace("-", ".")
                }
                minTickGap={26}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={58}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickFormatter={(value: number) =>
                  formatChartTick(value * CENTS_PER_YUAN)
                }
              />
              <ReferenceLine y={0} stroke="var(--muted)" />
              <Tooltip
                formatter={(value) => `¥${Number(value).toFixed(MONEY_DIGITS)}`}
              />
              <Bar
                dataKey="income"
                name="收入"
                radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.date}
                    fill={
                      row.date === selected.date
                        ? "var(--chart-income)"
                        : "var(--chart-income-muted)"
                    }
                  />
                ))}
              </Bar>
              <Bar
                dataKey="expense"
                name="净支出"
                radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
                maxBarSize={16}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.date}
                    fill={
                      row.date === selected.date
                        ? "var(--chart-expense)"
                        : "var(--chart-expense-muted)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="cashflow-selection" aria-live="polite">
        <button
          type="button"
          aria-label="查看上一期收支"
          disabled={selectedIndex <= 0}
          onClick={() => setSelectedDate(rows[selectedIndex - 1].date)}
        >
          ‹
        </button>
        <div>
          <strong>{selected.date}</strong>
          <span>
            收入 ¥{money(selected.income)} · 净支出 ¥{money(selected.expense)}
          </span>
        </div>
        <button
          type="button"
          aria-label="查看下一期收支"
          disabled={selectedIndex >= rows.length - 1}
          onClick={() => setSelectedDate(rows[selectedIndex + 1].date)}
        >
          ›
        </button>
      </div>
      <details className="cashflow-details">
        <summary>
          查看 {selected.date} 的账单（{entries.length}）
        </summary>
        <ReportRecordList
          key={selected.date}
          records={entries}
          onRecord={onRecord}
        />
      </details>
    </>
  );
}
