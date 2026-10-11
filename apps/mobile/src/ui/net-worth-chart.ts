import { money } from "@hamster-ledger/core";

export interface NetWorthRow {
  date: string;
  amount: number | null;
  missing: string[];
}
export interface TrendPoint extends NetWorthRow {
  x: number;
  y: number | null;
}
export interface TrendSegment {
  id: string;
  line: string;
  area: string;
}
export const CHART_LAYOUT = {
  height: 196,
  left: 60,
  right: 12,
  top: 16,
  bottom: 30,
  labelSize: 11,
  tickCount: 3,
  rangePadding: 0.15,
  flatPadding: 0.01,
  minimumPadding: 100,
} as const;
const MINOR_PER_WAN = 1_000_000;
const MINOR_PER_YUAN = 100;
const NICE_STEPS = Object.values({
  unit: 1,
  double: 2,
  halfDecade: 5,
  decade: 10,
});
const DECIMAL_BASE = 10;
const PAIR_SIZE = 2;
const MONEY_PRECISION = 2;

function chartDomain(values: number[]): { lower: number; upper: number } {
  const minimum = Math.min(...values),
    maximum = Math.max(...values);
  const padding = Math.max(
    (maximum - minimum) * CHART_LAYOUT.rangePadding,
    Math.max(Math.abs(minimum), Math.abs(maximum)) * CHART_LAYOUT.flatPadding,
    CHART_LAYOUT.minimumPadding,
  );
  const roughStep =
    (maximum - minimum + padding * PAIR_SIZE) / (CHART_LAYOUT.tickCount - 1);
  const magnitude = DECIMAL_BASE ** Math.floor(Math.log10(roughStep));
  const step =
    (NICE_STEPS.find((value) => value >= roughStep / magnitude) ??
      DECIMAL_BASE) * magnitude;
  return {
    lower: Math.floor((minimum - padding) / step) * step,
    upper: Math.ceil((maximum + padding) / step) * step,
  };
}

function trendSegments(points: TrendPoint[], baseline: number): TrendSegment[] {
  const groups: TrendPoint[][] = [];
  let current: TrendPoint[] = [];
  for (const point of points) {
    if (point.y === null) {
      if (current.length) groups.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length) groups.push(current);
  return groups.map((group) => {
    const first = group[0],
      last = group[group.length - 1];
    const line = group.map((point) => `${point.x},${point.y}`).join(" ");
    return {
      id: first.date,
      line,
      area: `${first.x},${baseline} ${line} ${last.x},${baseline}`,
    };
  });
}

export function buildNetWorthChart(input: {
  rows: NetWorthRow[];
  width: number;
  fontScale?: number;
}): {
  points: TrendPoint[];
  segments: TrendSegment[];
  ticks: Array<{ amount: number; y: number }>;
  left: number;
  right: number;
  bottom: number;
  height: number;
} {
  const scale = input.fontScale ?? 1;
  const left = CHART_LAYOUT.left * scale;
  const right = Math.max(left + 1, input.width - CHART_LAYOUT.right);
  const height = CHART_LAYOUT.height * scale;
  const bottom = height - CHART_LAYOUT.bottom * scale;
  const values = input.rows.flatMap((row) =>
    row.amount === null ? [] : [row.amount],
  );
  const domain = values.length ? chartDomain(values) : { lower: 0, upper: 1 };
  const firstDate = Date.parse(input.rows[0]?.date ?? "1970-01-01");
  const lastDate = Date.parse(
    input.rows[input.rows.length - 1]?.date ?? "1970-01-01",
  );
  const dateSpan = lastDate - firstDate;
  const yAt = (amount: number): number =>
    bottom -
    ((amount - domain.lower) / (domain.upper - domain.lower)) *
      (bottom - CHART_LAYOUT.top);
  const points = input.rows.map((row) => ({
    ...row,
    x: dateSpan
      ? left + ((Date.parse(row.date) - firstDate) / dateSpan) * (right - left)
      : (left + right) / PAIR_SIZE,
    y: row.amount === null ? null : yAt(row.amount),
  }));
  const ticks = values.length
    ? Array.from({ length: CHART_LAYOUT.tickCount }, (_, index) => {
        const amount =
          domain.upper -
          (index / (CHART_LAYOUT.tickCount - 1)) *
            (domain.upper - domain.lower);
        return { amount, y: yAt(amount) };
      })
    : [];
  return {
    points,
    segments: trendSegments(points, bottom),
    ticks,
    left,
    right,
    bottom,
    height,
  };
}

export function nearestTrendPoint(
  points: TrendPoint[],
  x: number,
): TrendPoint | undefined {
  return points.reduce<TrendPoint | undefined>(
    (nearest, point) =>
      !nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x)
        ? point
        : nearest,
    undefined,
  );
}

export function formatTrendTick(amount: number): string {
  if (Math.abs(amount) >= MINOR_PER_WAN)
    return `${Number((amount / MINOR_PER_WAN).toFixed(MONEY_PRECISION))}万`;
  return String(Number((amount / MINOR_PER_YUAN).toFixed(MONEY_PRECISION)));
}

export function netWorthChange(rows: NetWorthRow[]): number | null {
  const first = rows[0]?.amount,
    last = rows[rows.length - 1]?.amount;
  return first == null || last == null || rows.length < PAIR_SIZE
    ? null
    : last - first;
}

export function netWorthLabel(row: NetWorthRow): string {
  return `${row.date}，${row.amount === null ? `缺少 ${row.missing.join("、")} 汇率` : `净资产 ¥${money(row.amount)}`}`;
}
