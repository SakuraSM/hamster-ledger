export const DONUT_LAYOUT = { size: 192, radius: 74, strokeWidth: 22 } as const;
const DIAMETER_DIVISOR = 2;
const FULL_CIRCLE = Math.PI * DIAMETER_DIVISOR;
const HALF_CIRCLE = Math.PI;
const START_ANGLE = -Math.PI / DIAMETER_DIVISOR;
const COORDINATE_DIGITS = 3;

function coordinate(value: number): string {
  return String(Number(value.toFixed(COORDINATE_DIGITS)));
}
function point(angle: number): string {
  const center = DONUT_LAYOUT.size / DIAMETER_DIVISOR;
  return `${coordinate(center + DONUT_LAYOUT.radius * Math.cos(angle))} ${coordinate(center + DONUT_LAYOUT.radius * Math.sin(angle))}`;
}
function arc(start: number, end: number): string {
  const radius = DONUT_LAYOUT.radius;
  const large = end - start > HALF_CIRCLE ? 1 : 0;
  return `A ${radius} ${radius} 0 ${large} 1 ${point(end)}`;
}
export function buildDistributionSegments(
  slices: Array<{ name: string; amount: number }>,
): Array<{ name: string; fraction: number; path: string }> {
  const positive = slices.filter((slice) => slice.amount > 0);
  if (!positive.length) return [];
  const maximum = Math.max(...positive.map((slice) => slice.amount));
  const total = positive.reduce(
    (sum, slice) => sum + slice.amount / maximum,
    0,
  );
  let angle = START_ANGLE;
  return positive.map((slice) => {
    const fraction = slice.amount / maximum / total;
    const start = angle;
    const end = start + fraction * FULL_CIRCLE;
    angle = end;
    const path =
      fraction === 1
        ? `M ${point(start)} ${arc(start, start + HALF_CIRCLE)} ${arc(start + HALF_CIRCLE, end)}`
        : `M ${point(start)} ${arc(start, end)}`;
    return { name: slice.name, fraction, path };
  });
}
