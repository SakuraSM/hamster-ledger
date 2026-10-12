import { useId, useState } from "react";
import {
  Pressable,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useTheme } from "react-native-paper";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Polygon,
  Polyline,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import {
  buildNetWorthChart,
  CHART_LAYOUT,
  formatTrendTick,
  nearestTrendPoint,
  netWorthLabel,
  type NetWorthRow,
} from "./net-worth-chart";

interface NetWorthChartProps {
  rows: NetWorthRow[];
  selectedDate: string;
  onSelect: (date: string) => void;
}
const DEFAULT_CHART_WIDTH = 320;
const LINE_WIDTH = 2.5;
const POINT_RADIUS = 3;
const SELECTED_RADIUS = 5;
const LABEL_OFFSET = 8;
const SVG_BASELINE_DIVISOR = 3;
const MONTH_DATE_OFFSET = 5;

export function NetWorthChart({
  rows,
  selectedDate,
  onSelect,
}: NetWorthChartProps): React.JSX.Element {
  const theme = useTheme(),
    { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const chart = buildNetWorthChart({ rows, width, fontScale });
  const selected = chart.points.find((point) => point.date === selectedDate);
  const fontSize = CHART_LAYOUT.labelSize * fontScale;
  const first = chart.points[0],
    last = chart.points[chart.points.length - 1];
  function measureChart(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width);
  }
  function selectPoint(event: GestureResponderEvent): void {
    const point = nearestTrendPoint(chart.points, event.nativeEvent.locationX);
    if (point) onSelect(point.date);
  }
  return (
    <Pressable
      onLayout={measureChart}
      onPress={selectPoint}
      accessibilityRole="button"
      accessibilityLabel={
        selected ? `资产趋势图，${netWorthLabel(selected)}` : "资产趋势图"
      }
      accessibilityHint="点选曲线查看金额，也可使用下方的上一期、下一期按钮。"
    >
      <Svg width={width} height={chart.height} accessible={false}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={theme.colors.primary}
              stopOpacity={0.17}
            />
            <Stop
              offset="1"
              stopColor={theme.colors.primary}
              stopOpacity={0.01}
            />
          </LinearGradient>
        </Defs>
        {chart.ticks.map((tick) => (
          <Line
            key={tick.amount}
            x1={chart.left}
            x2={chart.right}
            y1={tick.y}
            y2={tick.y}
            stroke={theme.colors.outlineVariant}
            strokeDasharray="3 5"
            strokeWidth={1}
          />
        ))}
        {chart.segments.map((segment) => (
          <Polygon
            key={segment.id}
            points={segment.area}
            fill={`url(#${gradientId})`}
          />
        ))}
        {chart.segments.map((segment) => (
          <Polyline
            key={segment.id}
            points={segment.line}
            stroke={theme.colors.primary}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {selected && selected.y !== null ? (
          <Line
            x1={selected.x}
            x2={selected.x}
            y1={CHART_LAYOUT.top}
            y2={chart.bottom}
            stroke={theme.colors.primary}
            strokeDasharray="3 4"
            strokeOpacity={0.5}
          />
        ) : null}
        {chart.points.map((point) =>
          point.y === null ? null : (
            <Circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={point.date === selectedDate ? SELECTED_RADIUS : POINT_RADIUS}
              fill={
                point.date === selectedDate
                  ? theme.colors.primary
                  : theme.colors.surface
              }
              stroke={theme.colors.primary}
              strokeWidth={LINE_WIDTH}
            />
          ),
        )}
        {chart.ticks.map((tick) => (
          <SvgText
            key={tick.amount}
            x={chart.left - LABEL_OFFSET}
            y={tick.y + fontSize / SVG_BASELINE_DIVISOR}
            fontSize={fontSize}
            fill={theme.colors.onSurfaceVariant}
            textAnchor="end"
          >
            {formatTrendTick(tick.amount)}
          </SvgText>
        ))}
        {first ? (
          <SvgText
            x={first.x}
            y={chart.height - LABEL_OFFSET}
            fontSize={fontSize}
            fill={theme.colors.onSurfaceVariant}
            textAnchor={rows.length === 1 ? "middle" : "start"}
          >
            {first.date.slice(MONTH_DATE_OFFSET).replace("-", "/")}
          </SvgText>
        ) : null}
        {last && last !== first ? (
          <SvgText
            x={last.x}
            y={chart.height - LABEL_OFFSET}
            fontSize={fontSize}
            fill={theme.colors.onSurfaceVariant}
            textAnchor="end"
          >
            {last.date.slice(MONTH_DATE_OFFSET).replace("-", "/")}
          </SvgText>
        ) : null}
      </Svg>
    </Pressable>
  );
}
