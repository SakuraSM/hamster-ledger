import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import {
  cashFlowBucketRecords,
  cashFlowBuckets,
  money,
  type BillRecord,
} from "@hamster-ledger/core";
import {
  buildCashFlowChart,
  nearestCashFlowPoint,
} from "../ui/cash-flow-chart";
import { formatTrendTick } from "../ui/net-worth-chart";
import { ReportRecordList } from "./ReportRecordList";

const DEFAULT_WIDTH = 320;
const LABEL_SIZE = 10;
const LABEL_BASELINE = 3;
const LABEL_BOTTOM = 7;
const AXIS_LABEL_OFFSET = 5;
const MONTH_DAY_OFFSET = 5;
const SHORT_YEAR_OFFSET = 2;
interface CashFlowChartProps {
  records: BillRecord[];
  start: string;
  end: string;
  onRecord?: (record: BillRecord) => void;
}
export function CashFlowChart({
  records,
  start,
  end,
  onRecord,
}: CashFlowChartProps): React.JSX.Element {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selectedDate, setSelectedDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const { rows, granularity, isRangeTooLarge } = useMemo(
    () => cashFlowBuckets({ records, start, end }),
    [records, start, end],
  );
  const requestedIndex = rows.findIndex((row) => row.date === selectedDate);
  const index = requestedIndex < 0 ? rows.length - 1 : requestedIndex;
  const selected = rows[index];
  const chart = useMemo(
    () => buildCashFlowChart({ rows, width, fontScale }),
    [rows, width, fontScale],
  );
  const entries = useMemo(
    () =>
      selected
        ? cashFlowBucketRecords({ records, date: selected.date, start, end })
        : [],
    [records, selected, start, end],
  );
  const hasValues = rows.some((row) => row.income !== 0 || row.expense !== 0);
  const income = theme.dark ? tokens.chart.incomeDark : tokens.chart.income;
  const expense = theme.dark ? tokens.chart.expenseDark : tokens.chart.expense;
  const incomeMuted = theme.dark
    ? tokens.chart.incomeMutedDark
    : tokens.chart.incomeMuted;
  const expenseMuted = theme.dark
    ? tokens.chart.expenseMutedDark
    : tokens.chart.expenseMuted;
  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }
  function selectPoint(event: GestureResponderEvent): void {
    const point = nearestCashFlowPoint(
      chart.points,
      event.nativeEvent.locationX,
    );
    if (point) setSelectedDate(point.date);
  }
  return (
    <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
      <Card.Content style={styles.content}>
        <Text variant="titleLarge" accessibilityRole="header">
          收支趋势
        </Text>
        <Text variant="bodySmall">
          {granularity === "day" ? "按日" : "按月"} · 收入与净支出 ·
          退款抵减支出
        </Text>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: income }]} />
          <Text variant="bodySmall">收入</Text>
          <View style={[styles.legendDot, { backgroundColor: expense }]} />
          <Text variant="bodySmall">净支出</Text>
        </View>
        {isRangeTooLarge ? (
          <Text>时间范围涉及超过 120 个自然月，请缩短后查看趋势。</Text>
        ) : !selected ? (
          <Text>请选择有效的时间范围。</Text>
        ) : (
          <>
            {hasValues ? (
              <Pressable
                onLayout={measure}
                onPress={selectPoint}
                accessibilityRole="button"
                accessibilityLabel={`收支趋势，${selected.date}，收入 ¥${money(selected.income)}，净支出 ¥${money(selected.expense)}`}
                accessibilityHint="点击图表查看日期，也可使用上一期和下一期按钮。"
              >
                <Svg width={width} height={chart.height} accessible={false}>
                  {chart.ticks.map((tick) => (
                    <Line
                      key={tick.y}
                      x1={chart.left}
                      x2={chart.right}
                      y1={tick.y}
                      y2={tick.y}
                      stroke={theme.colors.outlineVariant}
                      strokeDasharray="3 5"
                    />
                  ))}
                  <Line
                    x1={chart.left}
                    x2={chart.right}
                    y1={chart.zeroY}
                    y2={chart.zeroY}
                    stroke={theme.colors.onSurfaceVariant}
                  />
                  {chart.points.map((point) => (
                    <Rect
                      key={`${point.date}-income`}
                      {...point.incomeBar}
                      fill={point.date === selected.date ? income : incomeMuted}
                    />
                  ))}
                  {chart.points.map((point) => (
                    <Rect
                      key={`${point.date}-expense`}
                      {...point.expenseBar}
                      fill={
                        point.date === selected.date ? expense : expenseMuted
                      }
                    />
                  ))}
                  {chart.ticks.map((tick) => (
                    <SvgText
                      key={tick.y}
                      x={chart.left - AXIS_LABEL_OFFSET}
                      y={tick.y + LABEL_BASELINE * fontScale}
                      fontSize={LABEL_SIZE * fontScale}
                      fill={theme.colors.onSurfaceVariant}
                      textAnchor="end"
                    >
                      {formatTrendTick(tick.value)}
                    </SvgText>
                  ))}
                  {chart.points[0] ? (
                    <SvgText
                      x={chart.left}
                      y={chart.height - LABEL_BOTTOM}
                      fontSize={LABEL_SIZE * fontScale}
                      fill={theme.colors.onSurfaceVariant}
                    >
                      {chart.points[0].date
                        .slice(
                          granularity === "day"
                            ? MONTH_DAY_OFFSET
                            : SHORT_YEAR_OFFSET,
                        )
                        .replace("-", ".")}
                    </SvgText>
                  ) : null}
                  {chart.points.length > 1 ? (
                    <SvgText
                      x={chart.right}
                      y={chart.height - LABEL_BOTTOM}
                      fontSize={LABEL_SIZE * fontScale}
                      fill={theme.colors.onSurfaceVariant}
                      textAnchor="end"
                    >
                      {chart.points[chart.points.length - 1].date
                        .slice(
                          granularity === "day"
                            ? MONTH_DAY_OFFSET
                            : SHORT_YEAR_OFFSET,
                        )
                        .replace("-", ".")}
                    </SvgText>
                  ) : null}
                </Svg>
              </Pressable>
            ) : (
              <Text>该范围的收入和净支出均为零。</Text>
            )}
            <View style={styles.selection} accessibilityLiveRegion="polite">
              <Button
                compact
                onPress={() => setSelectedDate(rows[index - 1].date)}
                disabled={index <= 0}
                accessibilityLabel="查看上一期收支"
              >
                上一期
              </Button>
              <View style={styles.selected}>
                <Text variant="titleSmall">{selected.date}</Text>
                <Text variant="bodySmall">
                  收入 ¥{money(selected.income)} · 净支出 ¥
                  {money(selected.expense)}
                </Text>
              </View>
              <Button
                compact
                onPress={() => setSelectedDate(rows[index + 1].date)}
                disabled={index >= rows.length - 1}
                accessibilityLabel="查看下一期收支"
              >
                下一期
              </Button>
            </View>
            <Button
              onPress={() => setShowDetails(!showDetails)}
              accessibilityState={{ expanded: showDetails }}
            >
              {showDetails
                ? "收起账单明细"
                : `查看 ${selected.date} 账单（${entries.length}）`}
            </Button>
            {showDetails ? (
              <View style={styles.details}>
                <ReportRecordList
                  key={selected.date}
                  records={entries}
                  onRecord={onRecord}
                />
              </View>
            ) : null}
          </>
        )}
      </Card.Content>
    </Card>
  );
}
const styles = StyleSheet.create({
  content: { gap: 12 },
  legend: { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  selection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  selected: { flex: 1, alignItems: "center", gap: 4 },
  details: { gap: 6 },
});
