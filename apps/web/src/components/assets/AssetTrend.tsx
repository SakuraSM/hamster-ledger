const MINOR_PER_YUAN = 100;
const MONTH_DAY_OFFSET = 5;
const MONEY_PRECISION = 2;
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { assetTrendStart, money, type Ledger } from "@hamster-ledger/core";
import { useReportData } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
interface AssetTrendProps {
  ledger: Ledger;
  end: string;
}
export function AssetTrend({
  ledger,
  end,
}: AssetTrendProps): React.JSX.Element {
  const start = assetTrendStart({ ledger, end });
  const report = useReportData({
    ledger,
    start,
    end,
    client: useNetworkClient(),
  });
  if (!ledger.accounts.some((account) => !account.isArchived)) return <></>;
  if (start > end)
    return <p className="muted">此日期以前尚无完整余额基准，暂不绘制趋势。</p>;
  return (
    <section className="asset-trend">
      <div className="section-heading">
        <h2>净资产趋势</h2>
        <span>近六个月 · 人民币</span>
      </div>
      <p className="muted small">
        从 {start}{" "}
        起按月末及起止日比较，使用当前未归档账户。缺少历史基准的日期不作比较。
      </p>
      {report.error ? <p role="alert">{report.error}</p> : null}
      {report.isLoading ? <p role="status">正在查询参考汇率…</p> : null}
      <div
        className="asset-trend-chart"
        role="group"
        aria-label="净资产趋势，金额可在趋势明细中查看"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={report.rows.map((row) => ({
              ...row,
              value: row.amount === null ? null : row.amount / MINOR_PER_YUAN,
            }))}
            margin={{ top: 12, right: 24, bottom: 4, left: 12 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(MONTH_DAY_OFFSET)}
            />
            <YAxis width={78} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value) =>
                `¥ ${Number(value).toFixed(MONEY_PRECISION)}`
              }
            />
            <Line
              dataKey="value"
              name="净资产"
              stroke="#a96140"
              strokeWidth={2}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>查看趋势明细</summary>
        {report.rows.map((row) => (
          <p key={row.date}>
            {row.date} ·{" "}
            {row.amount === null
              ? `缺少 ${row.missing.join("、")} 汇率，暂无估值`
              : `¥ ${money(row.amount)}`}
          </p>
        ))}
      </details>
    </section>
  );
}
