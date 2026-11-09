import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import Svg, { Circle, Path } from "react-native-svg";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import {
  money,
  reportDistribution,
  reportGroupRecords,
  type BillRecord,
} from "@hamster-ledger/core";
import { ReportRecordList } from "./ReportRecordList";
import {
  buildDistributionSegments,
  DONUT_LAYOUT,
} from "../ui/distribution-chart";

const CHART_SIZE = DONUT_LAYOUT.size;
const RADIUS = DONUT_LAYOUT.radius;
const STROKE_WIDTH = DONUT_LAYOUT.strokeWidth;
const DIAMETER_DIVISOR = 2;
const UNSELECTED_OPACITY = 0.55;
interface ReportDistributionProps {
  groups: Array<{ name: string; amount: number }>;
  records: BillRecord[];
  dimension: "category" | "tag";
  kind: "支出" | "收入";
  onRecord?: (record: BillRecord) => void;
}
export function ReportDistribution({
  groups,
  records,
  dimension,
  kind,
  onRecord,
}: ReportDistributionProps): React.JSX.Element {
  const theme = useTheme();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = groups.find((group) => group.name === selectedName);
  const data = reportDistribution(groups);
  const palette = theme.dark
    ? tokens.chart.categoriesDark
    : tokens.chart.categories;
  const segments = buildDistributionSegments(data.slices);
  const matching = selected
    ? reportGroupRecords({ records, dimension, kind, name: selected.name })
    : [];
  function toggleGroup(name: string): void {
    setSelectedName((current) => (current === name ? null : name));
  }
  return (
    <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
      <Card.Content style={styles.content}>
        <Text variant="titleLarge" accessibilityRole="header">
          收支分布
        </Text>
        <Text variant="bodySmall">选择分类，查看对应账单</Text>
        {data.slices.length ? (
          <View
            style={styles.chart}
            accessible
            accessibilityLabel={`正向${dimension === "tag" ? "标签" : "分类"}合计 ${data.total === null ? "金额过大" : `¥${money(data.total)}`}，分类占比见下方列表`}
          >
            <Svg width={CHART_SIZE} height={CHART_SIZE} accessible={false}>
              <Circle
                cx={CHART_SIZE / DIAMETER_DIVISOR}
                cy={CHART_SIZE / DIAMETER_DIVISOR}
                r={RADIUS}
                fill="none"
                stroke={theme.colors.outlineVariant}
                strokeWidth={STROKE_WIDTH}
              />
              {segments.map((segment, index) => (
                <Path
                  key={segment.name}
                  d={segment.path}
                  fill="none"
                  stroke={palette[index % palette.length]}
                  opacity={
                    selected && selected.name !== segment.name
                      ? UNSELECTED_OPACITY
                      : 1
                  }
                  onPress={() => toggleGroup(segment.name)}
                  strokeWidth={STROKE_WIDTH}
                />
              ))}
            </Svg>
            <View style={styles.chartCenter} pointerEvents="none">
              <Text variant="labelSmall">
                正向{dimension === "tag" ? "标签" : "分类"}合计
              </Text>
              <Text
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {data.total === null ? "金额过大" : `¥${money(data.total)}`}
              </Text>
            </View>
          </View>
        ) : (
          <Text>这个时间段暂无正向{kind}分布。</Text>
        )}
        {dimension === "tag" ? (
          <Text variant="bodySmall">
            一笔账单可含多个标签，标签合计可能重复。
          </Text>
        ) : null}
        {data.hasNegativeGroups ? (
          <Text variant="bodySmall">
            退款超过支出的分类单独列出，不计入正向占比。
          </Text>
        ) : null}
        {groups.map((group) => {
          const index = data.slices.findIndex(
            (slice) => slice.name === group.name,
          );
          const slice = data.slices[index];
          const share = slice ? `${slice.percent.toFixed(1)}%` : "退款抵减";
          return (
            <Pressable
              key={group.name}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}，${share}，¥${money(group.amount)}`}
              accessibilityState={{ selected: selected?.name === group.name }}
              onPress={() => toggleGroup(group.name)}
              style={[
                styles.group,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.groupLabel}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: slice
                        ? palette[index % palette.length]
                        : theme.colors.outline,
                    },
                  ]}
                />
                <Text style={styles.name}>{group.name}</Text>
              </View>
              <Text variant="bodySmall">{share}</Text>
              <Text style={styles.amount}>¥{money(group.amount)}</Text>
            </Pressable>
          );
        })}
        {selected ? (
          <View style={styles.detail}>
            <Text variant="titleMedium" accessibilityRole="header">
              {selected.name} · {matching.length} 笔
            </Text>
            <ReportRecordList
              key={selected.name}
              records={matching}
              onRecord={onRecord}
            />
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
}
const styles = StyleSheet.create({
  content: { gap: 12 },
  chart: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignSelf: "center",
    marginVertical: 8,
  },
  chartCenter: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },
  group: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  groupLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flexShrink: 1 },
  amount: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  detail: { gap: 8, paddingTop: 6 },
});
