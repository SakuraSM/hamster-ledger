import { describe, expect, it } from "vitest";
import {
  buildCashFlowChart,
  nearestCashFlowPoint,
} from "../apps/mobile/src/ui/cash-flow-chart";

describe("native cash-flow chart geometry", () => {
  it("draws positive income above and refund-driven negative net expense below zero", () => {
    const chart = buildCashFlowChart({
      width: 340,
      rows: [
        { date: "2026-09-01", income: 20000, expense: 10000 },
        { date: "2026-09-02", income: 0, expense: -3000 },
        { date: "2026-09-03", income: 0, expense: 0 },
      ],
    });
    expect(chart.points[0].incomeBar.y).toBeLessThan(chart.zeroY);
    expect(chart.points[1].expenseBar.y).toBe(chart.zeroY);
    expect(chart.points[1].expenseBar.height).toBeGreaterThan(0);
    expect(chart.points[2].expenseBar.height).toBe(0);
    expect(nearestCashFlowPoint(chart.points, chart.points[1].x)?.date).toBe(
      "2026-09-02",
    );
  });
  it("keeps empty and flat ranges finite on narrow screens and large text", () => {
    const empty = buildCashFlowChart({ width: 0, rows: [] });
    expect(empty.points).toEqual([]);
    const chart = buildCashFlowChart({
      width: 80,
      fontScale: 1.5,
      rows: [{ date: "2026-09-01", income: 0, expense: 0 }],
    });
    expect(Number.isFinite(chart.zeroY)).toBe(true);
    expect(
      chart.points.every(
        (point) =>
          Number.isFinite(point.x) && Number.isFinite(point.incomeBar.height),
      ),
    ).toBe(true);
    expect(nearestCashFlowPoint([], 2)).toBeUndefined();
  });
});
