import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  convertToCny,
  formatCurrency,
  type AssetAccount,
} from "@hamster-ledger/core";
import type { RateQuote } from "@hamster-ledger/ledger-react";

interface AssetAccountContextProps {
  account: AssetAccount;
  rate?: RateQuote;
  balance: number | null;
  isAmountHidden: boolean;
  onManageRates: () => void;
}
export function AssetAccountContext({
  account,
  rate,
  balance,
  isAmountHidden,
  onManageRates,
}: AssetAccountContextProps): React.JSX.Element {
  const theme = useTheme();
  const currency = account.currency ?? "CNY";
  const amount = (minor: number): string =>
    isAmountHidden ? "••••" : formatCurrency({ minor, currency });
  const estimate =
    currency !== "CNY" && rate && balance !== null
      ? convertToCny({
          minor:
            account.kind === "liability" && balance < 0
              ? Math.abs(balance)
              : balance,
          currency,
          rate: rate.rate,
        })
      : null;
  const rateSource =
    rate?.source === "manual" ? "手动" : rate?.isCached ? "缓存参考" : "参考";
  return (
    <>
      {currency !== "CNY" ? (
        <View
          style={[
            styles.context,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="titleMedium">外币估值</Text>
          <Text>
            {rate
              ? `参考汇率 ${rate.rate} · ${rate.date} · ${rateSource}`
              : "缺少汇率，暂无法折合人民币。"}
          </Text>
          <Text>
            {estimate === null
              ? "人民币估值待补全"
              : `折合人民币 ${isAmountHidden ? "••••" : formatCurrency({ minor: estimate, currency: "CNY" })}`}
          </Text>
          <Button contentStyle={styles.touch} onPress={onManageRates}>
            管理参考汇率
          </Button>
        </View>
      ) : null}
      {account.type === "信用卡" ? (
        <View
          style={[
            styles.context,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="titleMedium">信用卡信息</Text>
          <Text>
            账单日{" "}
            {account.statementDay
              ? `每月 ${account.statementDay} 日`
              : "未设置"}{" "}
            · 还款日{" "}
            {account.paymentDay ? `每月 ${account.paymentDay} 日` : "未设置"}
          </Text>
          <Text>
            信用额度{" "}
            {account.creditLimit === undefined
              ? "未设置"
              : amount(account.creditLimit)}
          </Text>
          <Text>还款从所选账户转入，不记作支出。</Text>
        </View>
      ) : null}
      {account.type === "投资" ? (
        <Text>投资余额按已确认的基准和关联流水计算，不自动更新市场估值。</Text>
      ) : null}
      {account.type === "网络钱包" ? (
        <Text>
          仅已关联本账户的流水影响余额，不会根据支付平台推断资金账户。
        </Text>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  context: { padding: 16, borderRadius: 12, gap: 8 },
  touch: { minHeight: 48 },
});
