import { useState } from "react";
import { netWorthRangeStart, type Ledger } from "@hamster-ledger/core";
import { useReportData } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { NetWorthVisualization } from "../planning/NetWorthVisualization";

const DEFAULT_TREND_MONTHS = 6;
const RANGES = [
  { label: "1 月", months: 1 },
  { label: "3 月", months: 3 },
  { label: "6 月", months: 6 },
  { label: "1 年", months: 12 },
] as const;
interface AssetTrendProps {
  ledger: Ledger;
  end: string;
  isHidden: boolean;
}
export function AssetTrend({
  ledger,
  end,
  isHidden,
}: AssetTrendProps): React.JSX.Element {
  const [months, setMonths] = useState<number>(DEFAULT_TREND_MONTHS);
  const start = netWorthRangeStart({ end, months });
  const report = useReportData({
    ledger,
    start,
    end,
    client: useNetworkClient(),
  });
  const hasAccounts = ledger.accounts.some(
    (account) => !account.isArchived || account.archiveHistory?.length,
  );
  return (
    <section className="asset-trend">
      <div className="section-heading">
        <h2>净资产趋势</h2>
        <span>人民币 CNY</span>
      </div>
      <div className="net-worth-ranges" aria-label="净资产趋势时间范围">
        {RANGES.map((range) => (
          <button
            type="button"
            key={range.months}
            aria-pressed={months === range.months}
            onClick={() => setMonths(range.months)}
          >
            {range.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        {start} 至 {end} · 按月末及起止日估值；缺少基准或汇率的日期留空。
      </p>
      {report.error ? <p role="alert">{report.error}</p> : null}
      {report.isLoading ? <p role="status">正在查询参考汇率…</p> : null}
      <NetWorthVisualization
        key={`${start}:${end}`}
        rows={report.rows}
        isHidden={isHidden}
        hasAccounts={hasAccounts}
      />
    </section>
  );
}
