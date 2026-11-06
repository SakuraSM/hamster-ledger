import { type summarizeAssets, type compareAssets } from "@hamster-ledger/core";
import { UnstyledButton } from "@mantine/core";
import { Icons } from "../Icons";
import { cnyAmount } from "./asset-format";

interface AssetTotalsProps {
  totals: ReturnType<typeof summarizeAssets>;
  comparison: ReturnType<typeof compareAssets>;
  isDemo: boolean;
  isHidden: boolean;
  through: string;
  onToggleAmounts: () => void;
}

export function AssetTotals({
  totals,
  comparison,
  isDemo,
  isHidden,
  through,
  onToggleAmounts,
}: AssetTotalsProps): React.JSX.Element {
  const isPartial = Boolean(
    totals.missingCurrencies.length || totals.missingBaselines.length,
  );
  const hasValuation = totals.balances.some(
    ({ account, baseline }) =>
      Boolean(baseline) &&
      !totals.missingCurrencies.includes(account.currency ?? "CNY"),
  );
  const value = (minor: number): string =>
    hasValuation ? cnyAmount(minor, isHidden) : "暂无估值";
  const change =
    comparison.netChange === null
      ? "暂无可比数据"
      : `${!isHidden && comparison.netChange >= 0 ? "+" : ""}${cnyAmount(comparison.netChange, isHidden)}`;

  return (
    <>
      <section className="asset-summary" aria-label="资产负债汇总">
        <div className="asset-net-total">
          <div className="asset-net-heading">
            <span>
              {isPartial ? "已估值净资产" : "当前净资产"}
              {isDemo ? " · 示例账本" : ""}
            </span>
            <UnstyledButton
              type="button"
              className="asset-visibility-toggle"
              aria-label={isHidden ? "显示金额" : "隐藏金额"}
              title={isHidden ? "显示金额" : "隐藏金额"}
              onClick={onToggleAmounts}
            >
              {isHidden ? (
                <Icons.EyeOff size={17} aria-hidden="true" />
              ) : (
                <Icons.Eye size={17} aria-hidden="true" />
              )}
            </UnstyledButton>
          </div>
          <strong>{value(totals.netAssets)}</strong>
        </div>
        <div className="asset-total-pair">
          <div>
            <span>总资产</span>
            <strong>{value(totals.assets)}</strong>
          </div>
          <div>
            <span>总负债</span>
            <strong>{value(totals.liabilities)}</strong>
          </div>
        </div>
      </section>
      <div className="asset-month-change">
        <span>本月净资产变化</span>
        <strong>{change}</strong>
        <small>相比 {comparison.previousDate}</small>
      </div>
      {totals.missingCurrencies.length ? (
        <p className="asset-notice" role="alert">
          {totals.missingCurrencies.join("、")} 缺少汇率；合计仅包含已估值账户。
        </p>
      ) : null}
      {totals.missingBaselines.length ? (
        <p className="asset-notice" role="status">
          {isHidden ? "部分账户" : totals.missingBaselines.join("、")}{" "}
          在此日期尚无余额基准，未计入合计。
        </p>
      ) : null}
      {comparison.unavailableAccounts.length ? (
        <p className="muted small">
          {isHidden ? "部分账户" : comparison.unavailableAccounts.join("、")}{" "}
          缺少月初以前的余额基准，无法比较。
        </p>
      ) : null}
      <p className="asset-total-caption">
        净资产 = 总资产 − 总负债 · 截至 {through} · 按该日期的账户归档状态统计
      </p>
    </>
  );
}
