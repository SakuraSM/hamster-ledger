import { describe, expect, it } from "vitest";
import {
  buildNetWorthChart,
  nearestTrendPoint,
  netWorthChange,
  formatTrendTick,
  type NetWorthRow,
} from "../apps/mobile/src/ui/net-worth-chart";

function row(date: string, amount: number | null): NetWorthRow {
  return { date, amount, missing: amount === null ? ["USD"] : [] };
}
const width = 340;
describe("native net worth chart", () => {
  it("positions dates by elapsed time, including a short final period", () => {
    const chart = buildNetWorthChart({
      rows: [
        row("2026-09-01", 11000000),
        row("2026-09-30", 12000000),
        row("2026-10-11", 12100000),
      ],
      width,
    });
    const [first, middle, last] = chart.points;
    expect((middle.x - first.x) / (last.x - first.x)).toBeCloseTo(29 / 40);
    expect(chart.ticks[0].amount).toBeGreaterThan(12100000);
    expect(chart.ticks[2].amount).toBeLessThan(11000000);
    expect(first.y).toBeGreaterThan(last.y!);
  });
  it("keeps missing FX as a selectable gap, never drawing a false connection", () => {
    const rows = [
      row("2026-01-01", 10000),
      row("2026-01-31", null),
      row("2026-02-28", 20000),
    ];
    const chart = buildNetWorthChart({ rows, width });
    expect(chart.segments).toHaveLength(2);
    expect(chart.points[1].y).toBeNull();
    expect(
      nearestTrendPoint(chart.points, chart.points[1].x)?.amount,
    ).toBeNull();
    expect(netWorthChange([rows[1], rows[2]])).toBeNull();
  });
  it.each([0, 12345, -12345])(
    "shows a single or flat value %s without invalid coordinates",
    (amount) => {
      const chart = buildNetWorthChart({
        rows: [row("2026-10-11", amount)],
        width,
      });
      expect(chart.points[0].x).toBe((chart.left + chart.right) / 2);
      expect(Number.isFinite(chart.points[0].y)).toBe(true);
      expect(chart.ticks.every((tick) => Number.isFinite(tick.amount))).toBe(
        true,
      );
    },
  );
  it("supports negative balances and signed period changes without percent claims", () => {
    const rows = [row("2026-09-01", -10000), row("2026-09-30", 10000)];
    const chart = buildNetWorthChart({ rows, width });
    expect(chart.ticks[0].amount).toBeGreaterThan(0);
    expect(chart.ticks[2].amount).toBeLessThan(0);
    expect(netWorthChange(rows)).toBe(20000);
    expect(netWorthChange([...rows].reverse())).toBe(-20000);
  });
  it("renders unchanged balances as a horizontal line and reports zero change", () => {
    const rows = [row("2026-10-01", 12455770), row("2026-10-11", 12455770)];
    const chart = buildNetWorthChart({ rows, width });
    expect(chart.points[0].y).toBe(chart.points[1].y);
    expect(chart.segments).toHaveLength(1);
    expect(netWorthChange(rows)).toBe(0);
  });
  it("handles all missing and empty results and clamps point selection to the ends", () => {
    const empty = buildNetWorthChart({ rows: [], width });
    expect(empty.segments).toEqual([]);
    expect(empty.ticks).toEqual([]);
    expect(nearestTrendPoint(empty.points, 0)).toBeUndefined();
    const missing = buildNetWorthChart({
      rows: [row("2026-10-11", null)],
      width,
    });
    expect(missing.ticks).toEqual([]);
    expect(missing.segments).toEqual([]);
    const chart = buildNetWorthChart({
      rows: [row("2026-10-01", 100), row("2026-10-11", 200)],
      width,
    });
    expect(nearestTrendPoint(chart.points, -100)?.date).toBe("2026-10-01");
    expect(nearestTrendPoint(chart.points, width * 2)?.date).toBe("2026-10-11");
    expect(netWorthChange([])).toBeNull();
  });
  it("labels money in yuan and wan while reserving space for enlarged axis labels", () => {
    expect(formatTrendTick(12500000)).toBe("12.5万");
    expect(formatTrendTick(-12500000)).toBe("-12.5万");
    expect(formatTrendTick(12345)).toBe("123.45");
    const normal = buildNetWorthChart({ rows: [], width });
    const large = buildNetWorthChart({ rows: [], width, fontScale: 1.3 });
    expect(large.left).toBeGreaterThan(normal.left);
    expect(large.height).toBeGreaterThan(normal.height);
  });
});
