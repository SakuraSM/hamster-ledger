const DATE_KEY_LENGTH = 10;
import { Button } from "@mantine/core";
import { money, type Ledger } from "@hamster-ledger/core";
import { useAssetSummary } from "@hamster-ledger/ledger-react";
import { localNow } from "../../platform/browser/runtime";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { Icons } from "../Icons";

interface AssetSnapshotProps {
  ledger: Ledger;
  onOpen: () => void;
}
export function AssetSnapshot({
  ledger,
  onOpen,
}: AssetSnapshotProps): React.JSX.Element {
  const date = localNow().slice(0, DATE_KEY_LENGTH);
  const { totals, comparison } = useAssetSummary({
    ledger,
    date,
    client: useNetworkClient(),
  });
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const value = (minor: number): string =>
    isHidden ? "••••" : `¥ ${money(minor)}`;
  return (
    <section className="asset-snapshot" aria-label="当前资产">
      <div>
        <span className="metric-label">当前净资产</span>
        <strong>
          {totals.missingCurrencies.length || totals.missingBaselines.length
            ? "估值待补全"
            : value(totals.netAssets)}
        </strong>
        <small>
          截至 {date} · {totals.balances.length} 个账户
        </small>
      </div>
      <div>
        <span>总资产</span>
        <strong>{value(totals.assets)}</strong>
      </div>
      <div>
        <span>总负债</span>
        <strong>{value(totals.liabilities)}</strong>
      </div>
      <div>
        <span>本月净资产变化</span>
        <strong>
          {comparison.netChange === null
            ? "暂无可比数据"
            : `${!isHidden && comparison.netChange > 0 ? "+" : ""}${value(comparison.netChange)}`}
        </strong>
      </div>
      <Button variant="subtle" onClick={onOpen}>
        管理资产 <Icons.Arrow size={18} />
      </Button>
    </section>
  );
}
