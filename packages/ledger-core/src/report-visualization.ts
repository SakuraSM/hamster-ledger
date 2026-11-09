import { dateSchema } from "./date-schemas.js";
import { addDays } from "./periods.js";
import { summarize, type BillRecord } from "./model.js";

const DAY_MILLISECONDS = 86_400_000;
const DAILY_BUCKET_LIMIT = 62;
const MONTHLY_BUCKET_LIMIT = 120;
const NET_WORTH_MONTH_LIMIT = 60;
const MONTH_KEY_LENGTH = 7;
const DATE_KEY_LENGTH = 10;
const MINOR_PER_YUAN = 100;
const MINOR_PER_WAN = 1_000_000;
const AXIS_DECIMALS = 2;
const BIGINT_ZERO = 0n;
const PERCENT_HUNDREDTH_SCALE = 10_000n;
const PERCENT_SCALE = 100;
const MONTHS_PER_YEAR = 12;

export function formatChartTick(minor: number): string {
  if (Math.abs(minor) >= MINOR_PER_WAN)
    return `${Number((minor / MINOR_PER_WAN).toFixed(AXIS_DECIMALS))}万`;
  return String(Number((minor / MINOR_PER_YUAN).toFixed(AXIS_DECIMALS)));
}

export function netWorthRangeStart(input: {
  end: string;
  months: number;
}): string {
  dateSchema.parse(input.end);
  if (
    !Number.isInteger(input.months) ||
    input.months < 1 ||
    input.months > NET_WORTH_MONTH_LIMIT
  )
    throw new Error("净资产趋势范围需为 1 至 60 个月。");
  const date = new Date(input.end + "T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() - input.months + 1, 1);
  return date.toISOString().slice(0, DATE_KEY_LENGTH);
}

export interface CashFlowBucket {
  date: string;
  expense: number;
  income: number;
}
export interface CashFlowBuckets {
  granularity: "day" | "month";
  rows: CashFlowBucket[];
  isRangeTooLarge: boolean;
}

export function reportDistribution(
  groups: Array<{ name: string; amount: number }>,
): {
  total: number | null;
  slices: Array<{ name: string; amount: number; percent: number }>;
  hasNegativeGroups: boolean;
} {
  const positive = groups.filter((group) => group.amount > 0);
  const total = positive.reduce(
    (sum, group) => sum + BigInt(group.amount),
    BIGINT_ZERO,
  );
  return {
    total: total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null,
    slices: positive.map((group) => ({
      ...group,
      percent:
        Number((BigInt(group.amount) * PERCENT_HUNDREDTH_SCALE) / total) /
        PERCENT_SCALE,
    })),
    hasNegativeGroups: groups.some((group) => group.amount < 0),
  };
}

/** Calendar buckets contain only recorded, confirmed income and net expenses. */
export function cashFlowBuckets(input: {
  records: BillRecord[];
  start: string;
  end: string;
}): CashFlowBuckets {
  dateSchema.parse(input.start);
  dateSchema.parse(input.end);
  const days =
    (Date.parse(input.end + "T00:00:00Z") -
      Date.parse(input.start + "T00:00:00Z")) /
      DAY_MILLISECONDS +
    1;
  const granularity = days <= DAILY_BUCKET_LIMIT ? "day" : "month";
  if (days <= 0) return { granularity, rows: [], isRangeTooLarge: false };
  const startMonth = new Date(input.start + "T00:00:00Z");
  const endMonth = new Date(input.end + "T00:00:00Z");
  const months =
    (endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) *
      MONTHS_PER_YEAR +
    endMonth.getUTCMonth() -
    startMonth.getUTCMonth() +
    1;
  if (granularity === "month" && months > MONTHLY_BUCKET_LIMIT)
    return { granularity, rows: [], isRangeTooLarge: true };
  const keys =
    granularity === "day"
      ? Array.from({ length: days }, (_, index) => addDays(input.start, index))
      : Array.from({ length: months }, (_, index) => {
          const year = startMonth.getUTCFullYear();
          const month = startMonth.getUTCMonth() + index;
          const date = new Date(0);
          date.setUTCFullYear(year, month, 1);
          return date.toISOString().slice(0, MONTH_KEY_LENGTH);
        });
  const grouped = new Map<string, BillRecord[]>();
  for (const record of input.records) {
    const date = record.date.slice(0, DATE_KEY_LENGTH);
    if (date < input.start || date > input.end) continue;
    const key = granularity === "day" ? date : date.slice(0, MONTH_KEY_LENGTH);
    const bucket = grouped.get(key) ?? [];
    bucket.push(record);
    grouped.set(key, bucket);
  }
  return {
    granularity,
    rows: keys.map((date) => {
      const { expense, income } = summarize(grouped.get(date) ?? []);
      return { date, expense, income };
    }),
    isRangeTooLarge: false,
  };
}

/** Return the same records counted by reportGroups for a selected category or tag. */
export function reportGroupRecords(input: {
  records: BillRecord[];
  dimension: "category" | "tag";
  kind: "支出" | "收入";
  name: string;
}): BillRecord[] {
  return input.records
    .filter((record) => {
      if (record.isDeleted || record.status !== "confirmed" || !record.amount)
        return false;
      if (
        input.kind === "收入"
          ? record.kind !== "收入"
          : record.kind !== "支出" && record.kind !== "退款"
      )
        return false;
      return input.dimension === "category"
        ? record.category === input.name
        : record.tags?.length
          ? record.tags.includes(input.name)
          : input.name === "无标签";
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function cashFlowBucketRecords(input: {
  records: BillRecord[];
  date: string;
  start: string;
  end: string;
}): BillRecord[] {
  return input.records
    .filter(
      (record) =>
        !record.isDeleted &&
        record.status === "confirmed" &&
        ["支出", "收入", "退款"].includes(record.kind) &&
        record.date.startsWith(input.date) &&
        record.date.slice(0, DATE_KEY_LENGTH) >= input.start &&
        record.date.slice(0, DATE_KEY_LENGTH) <= input.end,
    )
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function netWorthGapDescription(input: {
  missing: string[];
  missingBaselines?: string[];
}): string {
  const reasons: string[] = [];
  if (input.missingBaselines?.length)
    reasons.push(`缺少余额基准：${input.missingBaselines.join("、")}`);
  if (input.missing.length)
    reasons.push(`缺少汇率：${input.missing.join("、")}`);
  return reasons.join("；") || "暂无估值";
}
