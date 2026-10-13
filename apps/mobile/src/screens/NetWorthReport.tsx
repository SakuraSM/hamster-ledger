import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import { money, type Ledger } from "@hamster-ledger/core";
import { useReportData } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { AmountText } from "../ui/AmountText";
import { NetWorthChart } from "../ui/NetWorthChart";
import {
  netWorthChange,
  netWorthLabel,
  type NetWorthRow,
} from "../ui/net-worth-chart";

interface NetWorthReportProps {
  ledger: Ledger;
  start: string;
  end: string;
}
export function NetWorthReport({
  ledger,
  start,
  end,
}: NetWorthReportProps): React.JSX.Element {
  const { client } = useNativeAccount(),
    theme = useTheme();
  const report = useReportData({ ledger, start, end, client });
  const [selectedDate, setSelectedDate] = useState("");
  const [isDetailVisible, setDetailVisible] = useState(false);
  const selected =
    report.rows.find((row) => row.date === selectedDate) ??
    report.rows[report.rows.length - 1];
  const hasValues = report.rows.some((row) => row.amount !== null);
  const selectedIndex = report.rows.findIndex((row) => row === selected);
  function selectPrevious(): void {
    setSelectedDate(report.rows[selectedIndex - 1].date);
  }
  function selectNext(): void {
    setSelectedDate(report.rows[selectedIndex + 1].date);
  }
  function toggleDetails(): void {
    setDetailVisible(!isDetailVisible);
  }
  return (
    <Card
      mode="outlined"
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      }}
    >
      <Card.Content style={styles.content}>
        <View style={styles.heading}>
          <Text variant="titleMedium" accessibilityRole="header">
            净资产趋势
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            人民币 CNY
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {start} 至 {end}
        </Text>
        {report.error ? (
          <Text accessibilityRole="alert">{report.error}</Text>
        ) : null}
        {report.isLoading ? (
          <Text accessibilityLiveRegion="polite">正在查询参考汇率…</Text>
        ) : null}
        {!ledger.accounts.some((account) => !account.isArchived) ? (
          <Text>添加资产账户并设置余额后，即可查看净资产趋势。</Text>
        ) : (
          <>
            <View accessibilityLiveRegion="polite" style={styles.value}>
              <Text variant="bodySmall">
                {selected?.date} ·{" "}
                {selectedIndex === report.rows.length - 1
                  ? "期末净资产"
                  : "当日净资产"}
              </Text>
              <Text variant="headlineMedium" style={styles.amount}>
                {selected?.amount == null
                  ? "暂无估值"
                  : `¥${money(selected.amount)}`}
              </Text>
              <ChangeSummary rows={report.rows} />
            </View>
            {hasValues ? (
              <NetWorthChart
                rows={report.rows}
                selectedDate={selected?.date ?? ""}
                onSelect={setSelectedDate}
              />
            ) : (
              <Text>当前范围缺少估值所需的汇率，暂无法绘制趋势。</Text>
            )}
            {selected?.amount === null ? (
              <Text>缺少 {selected.missing.join("、")} 汇率，此期留空。</Text>
            ) : null}
            {report.rows.length > 1 ? (
              <View style={styles.controls}>
                <Button
                  compact
                  contentStyle={styles.control}
                  onPress={selectPrevious}
                  disabled={selectedIndex <= 0}
                  accessibilityLabel="查看上一期净资产"
                >
                  上一期
                </Button>
                <Text variant="labelSmall">
                  {selectedIndex + 1} / {report.rows.length}
                </Text>
                <Button
                  compact
                  contentStyle={styles.control}
                  onPress={selectNext}
                  disabled={selectedIndex >= report.rows.length - 1}
                  accessibilityLabel="查看下一期净资产"
                >
                  下一期
                </Button>
              </View>
            ) : null}
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              点选查看金额 · 刻度随范围缩放
            </Text>
            <Button
              compact
              onPress={toggleDetails}
              accessibilityState={{ expanded: isDetailVisible }}
              contentStyle={styles.detailButton}
            >
              {isDetailVisible ? "收起估值明细" : "查看估值明细"}
            </Button>
            {isDetailVisible ? <ValueDetails rows={report.rows} /> : null}
          </>
        )}
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          按月末及起止日估值，不含归档账户；缺汇率留空。
        </Text>
      </Card.Content>
    </Card>
  );
}
interface ChangeSummaryProps {
  rows: NetWorthRow[];
}
function ChangeSummary({ rows }: ChangeSummaryProps): React.JSX.Element {
  const change = netWorthChange(rows);
  if (rows.length === 1)
    return <Text variant="bodySmall">当前范围仅一个估值点，暂无期间变化</Text>;
  if (change === null)
    return <Text variant="bodySmall">起止日估值齐全后显示期间变化</Text>;
  return (
    <Text variant="bodyMedium">
      {change === 0 ? "期间持平 " : change > 0 ? "期间净增 " : "期间净减 "}
      <AmountText amount={change} tone="neutral">
        ¥{money(Math.abs(change))}
      </AmountText>
    </Text>
  );
}
interface ValueDetailsProps {
  rows: NetWorthRow[];
}
function ValueDetails({ rows }: ValueDetailsProps): React.JSX.Element {
  return (
    <View style={styles.details}>
      {rows.map((row) => (
        <Text
          key={row.date}
          variant="bodySmall"
          accessibilityLabel={netWorthLabel(row)}
        >
          {row.date} ·{" "}
          {row.amount === null
            ? `缺少 ${row.missing.join("、")} 汇率`
            : `¥${money(row.amount)}`}
        </Text>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 10 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  value: { gap: 6, paddingTop: 4 },
  amount: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  control: { minHeight: 48, justifyContent: "center" },
  detailButton: { minHeight: 48 },
  details: { gap: 8 },
});
