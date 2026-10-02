const DATE_KEY_LENGTH = 10;
import { summarize, type BillRecord } from "./model.js";
export function reportGroups({
  records,
  dimension,
  kind,
}: {
  records: BillRecord[];
  dimension: "category" | "tag";
  kind: "支出" | "收入";
}): Array<{ name: string; amount: number }> {
  const groups = new Map<string, number>();
  for (const record of records) {
    if (record.isDeleted || record.status !== "confirmed") continue;
    const amount =
      kind === "收入"
        ? record.kind === "收入"
          ? record.amount
          : 0
        : record.kind === "支出"
          ? record.amount
          : record.kind === "退款"
            ? -record.amount
            : 0;
    if (!amount) continue;
    const keys =
      dimension === "category"
        ? [record.category]
        : record.tags?.length
          ? record.tags
          : ["无标签"];
    for (const key of keys) groups.set(key, (groups.get(key) ?? 0) + amount);
  }
  return [...groups]
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);
}
export function reportTrend({
  records,
  start,
  end,
}: {
  records: BillRecord[];
  start: string;
  end: string;
}): Array<{ date: string; expense: number; income: number }> {
  const dates = [
    ...new Set(
      records
        .filter(
          (record) =>
            record.date.slice(0, DATE_KEY_LENGTH) >= start &&
            record.date.slice(0, DATE_KEY_LENGTH) <= end,
        )
        .map((record) => record.date.slice(0, DATE_KEY_LENGTH)),
    ),
  ].sort();
  return dates.map((date) => ({
    date,
    ...summarize(records.filter((record) => record.date.startsWith(date))),
  }));
}
