import { expect, it } from "vitest";
import { buildDistributionSegments } from "../apps/mobile/src/ui/distribution-chart";

it("builds distinct donut arcs proportional to amounts, including a complete single slice", () => {
  const segments = buildDistributionSegments([
    { name: "餐饮", amount: 300 },
    { name: "交通", amount: 100 },
  ]);
  expect(segments).toHaveLength(2);
  expect(segments[0].fraction).toBeCloseTo(0.75);
  expect(segments[1].fraction).toBeCloseTo(0.25);
  expect(segments[0].path).not.toBe(segments[1].path);
  const full = buildDistributionSegments([{ name: "唯一分类", amount: 100 }]);
  expect(full[0].fraction).toBe(1);
  expect(full[0].path.match(/ A /g)).toHaveLength(2);
  expect(buildDistributionSegments([])).toEqual([]);
});
