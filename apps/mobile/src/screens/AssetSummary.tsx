import { StyleSheet, View } from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";
import { money } from "@hamster-ledger/core";
import type { AssetSummaryController } from "@hamster-ledger/ledger-react";

interface AssetSummaryProps {
  valuationDate: string;
  totals: AssetSummaryController["totals"];
  comparison: AssetSummaryController["comparison"];
  isAmountHidden: boolean;
  onShowValuation: () => void;
  onToggleAmounts: () => void;
  onAdd: () => void;
}
export function AssetSummary({
  valuationDate,
  totals,
  comparison,
  isAmountHidden,
  onShowValuation,
  onToggleAmounts,
  onAdd,
}: AssetSummaryProps): React.JSX.Element {
  const theme = useTheme();
  const hasValuation = totals.balances.some(
    ({ account, baseline }) =>
      Boolean(baseline) &&
      !totals.missingCurrencies.includes(account.currency ?? "CNY"),
  );
  const amount = (minor: number): string =>
    hasValuation ? (isAmountHidden ? "••••" : `¥${money(minor)}`) : "暂无估值";
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text
            variant="headlineMedium"
            accessibilityRole="header"
            style={styles.strong}
          >
            资产
          </Text>
          <Button
            compact
            icon="chevron-right"
            contentStyle={styles.touch}
            onPress={onShowValuation}
          >
            截至 {valuationDate}
          </Button>
        </View>
        <Button
          mode="outlined"
          icon="plus"
          contentStyle={styles.touch}
          onPress={onAdd}
        >
          账户
        </Button>
      </View>
      <View style={styles.summary}>
        <View style={styles.summaryHeading}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {totals.missingCurrencies.length || totals.missingBaselines.length
              ? "已估值净资产"
              : "当前净资产"}
          </Text>
          <IconButton
            icon={isAmountHidden ? "eye-off-outline" : "eye-outline"}
            size={20}
            accessibilityLabel={
              isAmountHidden ? "显示资产金额" : "隐藏资产金额"
            }
            onPress={onToggleAmounts}
          />
        </View>
        <Text variant="displaySmall" style={styles.mainAmount}>
          {amount(totals.netAssets)}
        </Text>
        <View
          style={[styles.metrics, { borderColor: theme.colors.outlineVariant }]}
        >
          <View style={styles.metric}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>总资产</Text>
            <Text variant="headlineSmall" style={styles.strong}>
              {amount(totals.assets)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>总负债</Text>
            <Text variant="headlineSmall" style={styles.strong}>
              {amount(totals.liabilities)}
            </Text>
          </View>
        </View>
        <Text variant="titleMedium">
          本月变化{" "}
          {comparison.netChange === null
            ? "暂无可比数据"
            : `${!isAmountHidden && comparison.netChange >= 0 ? "+" : ""}${amount(comparison.netChange)}`}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          相比 {comparison.previousDate} · 含校准与汇率变化
        </Text>
      </View>
      {totals.missingCurrencies.length ? (
        <Text accessibilityRole="alert">
          {totals.missingCurrencies.join("、")} 缺少汇率；合计仅含已估值账户。
        </Text>
      ) : null}
      {totals.missingBaselines.length ? (
        <Text accessibilityRole="alert">
          {isAmountHidden ? "部分账户" : totals.missingBaselines.join("、")}{" "}
          在此日期尚无基准，未计入合计。
        </Text>
      ) : null}
      {comparison.unavailableAccounts.length ? (
        <Text>
          {isAmountHidden
            ? "部分账户"
            : comparison.unavailableAccounts.join("、")}{" "}
          缺少月初以前的余额基准。
        </Text>
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  summary: { gap: 4 },
  summaryHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -4,
  },
  mainAmount: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metric: { flexGrow: 1, gap: 2 },
  strong: { fontWeight: "700" },
  touch: { minHeight: 48 },
});
