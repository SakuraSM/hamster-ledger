import { DATE_KEY_LENGTH } from "../constants";
import { Button, Card, Text } from "react-native-paper";
import { money, type Ledger } from "@hamster-ledger/core";
import { useAssetSummary } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { localNow } from "../platform/runtime";
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
    client: useNativeAccount().client,
  });
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const amount = (minor: number): string =>
    isHidden ? "••••" : `¥${money(minor)}`;
  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 8 }}>
        <Text variant="titleMedium">当前净资产</Text>
        <Text variant="headlineLarge">
          {totals.missingCurrencies.length || totals.missingBaselines.length
            ? "估值待补全"
            : amount(totals.netAssets)}
        </Text>
        <Text>
          总资产 {amount(totals.assets)} · 总负债 {amount(totals.liabilities)}
        </Text>
        <Text>
          本月变化{" "}
          {comparison.netChange === null
            ? "暂无可比数据"
            : `${!isHidden && comparison.netChange > 0 ? "+" : ""}${amount(comparison.netChange)}`}
        </Text>
        <Text variant="bodySmall">
          截至 {date} · {totals.balances.length} 个账户
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={onOpen}>管理资产</Button>
      </Card.Actions>
    </Card>
  );
}
