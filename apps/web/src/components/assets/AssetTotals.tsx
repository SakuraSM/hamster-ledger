import {
  money,
  type summarizeAssets,
  type compareAssets,
} from "@hamster-ledger/core";
interface AssetTotalsProps {
  totals: ReturnType<typeof summarizeAssets>;
  comparison: ReturnType<typeof compareAssets>;
  isDemo: boolean;
  through: string;
}
export function AssetTotals({
  totals,
  comparison,
  isDemo,
  through,
}: AssetTotalsProps): React.JSX.Element {
  return (
    <>
      {totals.missingCurrencies.length ? (
        <p role="alert">
          {totals.missingCurrencies.join("、")}{" "}
          缺少汇率；下方合计仅含已估值账户。
        </p>
      ) : null}
      <section className="summary asset-summary" aria-label="资产负债汇总">
        <div className="summary-primary">
          <div className="metric-label">
            {totals.missingCurrencies.length || totals.missingBaselines.length
              ? "已估值净资产"
              : "净资产"}{" "}
            <small>{isDemo ? "（示例账本）" : ""}</small>
          </div>
          <strong>
            <span>¥</span>
            {money(totals.netAssets)}
          </strong>
        </div>
        <div>
          <div className="metric-label">总资产</div>
          <strong>
            <span>¥</span>
            {money(totals.assets)}
          </strong>
        </div>
        <div>
          <div className="metric-label">总负债</div>
          <strong>
            <span>¥</span>
            {money(totals.liabilities)}
          </strong>
        </div>
      </section>
      <div className="asset-month-change">
        <span>本月净资产变化</span>
        <strong>
          {comparison.netChange === null
            ? "暂无可比数据"
            : `${comparison.netChange >= 0 ? "+" : ""}¥ ${money(comparison.netChange)}`}
        </strong>
        <small>
          相比 {comparison.previousDate} ·
          含余额校准与汇率变化，不等同于收支结余
        </small>
      </div>
      {comparison.unavailableAccounts.length ? (
        <p className="muted small">
          {comparison.unavailableAccounts.join("、")} 缺少月初以前的余额基准。
        </p>
      ) : null}
      <p className="asset-total-caption">
        净资产 = 总资产 − 总负债 · 截至 {through} · 已归档账户不计入
      </p>
      {totals.missingBaselines.length ? (
        <p role="status">
          {totals.missingBaselines.join("、")}{" "}
          在此日期尚无余额基准，未计入合计。
        </p>
      ) : null}
    </>
  );
}
