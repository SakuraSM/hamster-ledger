import type { CashFlowBucket } from "@hamster-ledger/core";

const CHART_HEIGHT = 200;
const LEFT_MARGIN = 48;
const RIGHT_MARGIN = 10;
const TOP_MARGIN = 12;
const BOTTOM_MARGIN = 28;
const BAR_FRACTION = 0.29;
const MAX_BAR_WIDTH = 12;
const LABEL_COUNT = 3;
const BUCKET_CENTER_OFFSET = 0.5;
interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface CashFlowPoint extends CashFlowBucket {
  x: number;
  incomeBar: ChartBar;
  expenseBar: ChartBar;
}
export function buildCashFlowChart(input: {
  rows: CashFlowBucket[];
  width: number;
  fontScale?: number;
}): {
  points: CashFlowPoint[];
  ticks: Array<{ value: number; y: number }>;
  zeroY: number;
  left: number;
  right: number;
  height: number;
} {
  const scale = input.fontScale ?? 1;
  const height = CHART_HEIGHT * scale;
  const left = LEFT_MARGIN * scale;
  const right = Math.max(left + 1, input.width - RIGHT_MARGIN);
  const top = TOP_MARGIN;
  const bottom = height - BOTTOM_MARGIN * scale;
  const values = input.rows.flatMap((row) => [row.income, row.expense]);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const lower = minimum === maximum ? -1 : minimum;
  const upper = minimum === maximum ? 1 : maximum;
  const yAt = (value: number): number =>
    bottom - ((value - lower) / (upper - lower)) * (bottom - top);
  const zeroY = yAt(0);
  const bucketWidth = (right - left) / Math.max(1, input.rows.length);
  const barWidth = Math.max(
    1,
    Math.min(MAX_BAR_WIDTH, bucketWidth * BAR_FRACTION),
  );
  function bar(value: number, x: number): ChartBar {
    const y = yAt(value);
    return {
      x,
      y: Math.min(y, zeroY),
      width: barWidth,
      height: Math.abs(y - zeroY),
    };
  }
  return {
    left,
    right,
    height,
    zeroY,
    points: input.rows.map((row, index) => {
      const x = left + bucketWidth * (index + BUCKET_CENTER_OFFSET);
      return {
        ...row,
        x,
        incomeBar: bar(row.income, x - barWidth),
        expenseBar: bar(row.expense, x),
      };
    }),
    ticks: Array.from({ length: LABEL_COUNT }, (_, index) => {
      const value = upper - (index / (LABEL_COUNT - 1)) * (upper - lower);
      return { value, y: yAt(value) };
    }),
  };
}
export function nearestCashFlowPoint(
  points: CashFlowPoint[],
  x: number,
): CashFlowPoint | undefined {
  return points.reduce<CashFlowPoint | undefined>(
    (nearest, point) =>
      !nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x)
        ? point
        : nearest,
    undefined,
  );
}
