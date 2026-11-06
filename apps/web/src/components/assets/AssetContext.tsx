import { type compareAssets, type summarizeAssets } from "@hamster-ledger/core";
import { cnyAmount } from "./asset-format";

interface AssetContextProps {
  totals: ReturnType<typeof summarizeAssets>;
  comparison: ReturnType<typeof compareAssets>;
  date: string;
  isHidden: boolean;
  isDetail: boolean;
  onTrace: () => void;
  onSettings: (target: "date" | "rates") => void;
}

export function AssetContext({
  totals,
  comparison,
  date,
  isHidden,
  isDetail,
  onTrace,
  onSettings,
}: AssetContextProps): React.JSX.Element {
  const isPartial = Boolean(
    totals.missingCurrencies.length || totals.missingBaselines.length,
  );
  const hasValuation = totals.balances.some(
    ({ account, baseline }) =>
      Boolean(baseline) &&
      !totals.missingCurrencies.includes(account.currency ?? "CNY"),
  );
  const current = hasValuation
    ? cnyAmount(totals.netAssets, isHidden)
    : "暂无估值";
  const change =
    comparison.netChange === null
      ? "暂无可比数据"
      : `${!isHidden && comparison.netChange >= 0 ? "+" : ""}${cnyAmount(comparison.netChange, isHidden)}`;
  return (
    <aside className="asset-context" aria-label="资产说明">
      <p className="asset-context-kicker">资产管理 / {date}</p>
      <h2>{isDetail ? "余额，都能找到来处" : "这月的变化，拆开看"}</h2>
      <div className="asset-context-primary">
        <span>
          {isDetail
            ? isPartial
              ? "已估值净资产"
              : "当前净资产"
            : "净资产变化"}
        </span>
        <strong>{isDetail ? current : change}</strong>
      </div>
      <p>
        {comparison.netChange === null
          ? "缺少历史基准或汇率时，暂不计算本月变化。"
          : `比较 ${comparison.previousDate} 与当前估值日；变化包含余额校准和汇率变化。`}
      </p>
      <p className="asset-context-note">
        余额基于明确基准及之后的已确认流水。待确认、重复和已删除记录不会重复叠加。
      </p>
      <nav className="asset-context-links" aria-label="资产快捷入口">
        <button type="button" onClick={onTrace}>
          追溯余额与流水 <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={() => onSettings("date")}>
          估值日期与范围 <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={() => onSettings("rates")}>
          汇率与缺失项 <span aria-hidden="true">›</span>
        </button>
      </nav>
    </aside>
  );
}
