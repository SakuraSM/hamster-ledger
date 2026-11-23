import { valuationLabels, type ValuationMetric } from "@hamster-ledger/core";
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
  const [metric, setMetric] = useState<ValuationMetric>("netAssets");
  const [months, setMonths] = useState<number>(DEFAULT_TREND_MONTHS);
  const [earlier, setEarlier] = useState(false);
  const year = Number(end.slice(0, 4)) - (earlier ? 1 : 0);
  const selectedEnd = earlier ? year + "-12-31" : end;
  const start = earlier
    ? year + "-01-01"
    : netWorthRangeStart({ end: selectedEnd, months });
  const report = useReportData({
    ledger,
    start,
    end: selectedEnd,
    client: useNetworkClient(),
    metric,
  });
  const hasAccounts = ledger.accounts.some(
    (account) => !account.isArchived || account.archiveHistory?.length,
  );
  return (
    <section tabIndex={-1} className="asset-trend">
      <div className="section-heading">
        <h2>{valuationLabels[metric]}趋势</h2>
        <span>人民币 CNY</span>
      </div>
      <div className="net-worth-ranges" aria-label="净资产趋势时间范围">
        {RANGES.map((range) => (
          <button
            type="button"
            key={range.months}
            aria-pressed={!earlier && months === range.months}
            onClick={() => {
              setEarlier(false);
              setMonths(range.months);
            }}
          >
            {range.label}
          </button>
        ))}
      </div>
      <div className="net-worth-ranges" role="group" aria-label="趋势口径">
        {(Object.keys(valuationLabels) as ValuationMetric[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={metric === k}
            onClick={() => setMetric(k)}
          >
            {valuationLabels[k]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        aria-pressed={earlier}
        onClick={() => setEarlier(!earlier)}
      >
        {earlier
          ? "返回估值日"
          : "查看上年（" + (Number(end.slice(0, 4)) - 1) + "）"}
      </button>
      <p className="muted small">
        {start} 至 {selectedEnd} ·
        按月末及起止日估值；缺少基准或汇率的日期留空。
      </p>
      {report.error ? <p role="alert">{report.error}</p> : null}
      {report.isLoading ? <p role="status">正在查询参考汇率…</p> : null}
      <NetWorthVisualization
        key={`${start}:${end}`}
        label={valuationLabels[metric]}
        rows={report.rows}
        isHidden={isHidden}
        hasAccounts={hasAccounts}
      />
    </section>
  );
}
