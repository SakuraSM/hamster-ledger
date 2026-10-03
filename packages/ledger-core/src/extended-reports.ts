import { categoryDefinitions } from "./categories.js";
import { addMinor, type ExchangeRate } from "./currency.js";
import { splitAmount } from "./advanced-entries.js";
import { summarizeAssets } from "./asset-balances.js";
import { summarize, type BillRecord, type Ledger } from "./model.js";
import { dateSchema } from "./date-schemas.js";

/** Refunds inherit the original bill's shares, including deterministic remainder handling. */
export function memberExpenses(
  ledger: Ledger,
  records: BillRecord[],
): Array<{ memberId: string; amount: number }> {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (
      !record.amount ||
      record.isDeleted ||
      record.status !== "confirmed" ||
      !["支出", "退款"].includes(record.kind)
    )
      continue;
    const original =
      record.kind === "退款" && record.detail?.relatedId
        ? (ledger.records.find(
            (item) => item.id === record.detail?.relatedId,
          ) ?? record)
        : record;
    const shares =
      original.detail?.splits.filter((item) => item.amount > 0) ?? [];
    const allocation = shares.length
      ? splitAmount({
          amount: record.amount,
          members: shares.map((item) => ({
            id: item.memberId,
            weight: item.amount,
          })),
        })
      : [
          {
            memberId: original.detail?.memberId ?? "unassigned",
            amount: record.amount,
          },
        ];
    for (const share of allocation)
      totals.set(
        share.memberId,
        addMinor(
          totals.get(share.memberId) ?? 0,
          record.kind === "退款" ? -share.amount : share.amount,
        ),
      );
  }
  return [...totals]
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function categoryBreakdown(input: {
  ledger: Ledger;
  records: BillRecord[];
  kind: "支出" | "收入";
  parentId?: string;
}): Array<{ id: string; name: string; amount: number; hasChildren: boolean }> {
  const categories = categoryDefinitions(input.ledger);
  const groups = new Map<
    string,
    { id: string; name: string; amount: number; hasChildren: boolean }
  >();
  for (const record of input.records) {
    if (record.isDeleted || record.status !== "confirmed") continue;
    const amount =
      input.kind === "收入"
        ? record.kind === "收入"
          ? record.amount
          : 0
        : record.kind === "支出"
          ? record.amount
          : record.kind === "退款"
            ? -record.amount
            : 0;
    if (!amount) continue;
    const category = categories.find(
      (item) => item.name === record.category && item.kind === input.kind,
    );
    if (
      input.parentId &&
      category?.parentId !== input.parentId &&
      category?.id !== input.parentId
    )
      continue;
    const root = input.parentId
      ? category
      : (categories.find((item) => item.id === category?.parentId) ?? category);
    const id = root?.id ?? "legacy:" + record.category;
    const existing = groups.get(id) ?? {
      id,
      name: root?.name ?? record.category,
      amount: 0,
      hasChildren:
        !input.parentId && categories.some((item) => item.parentId === id),
    };
    existing.amount = addMinor(existing.amount, amount);
    groups.set(id, existing);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

export function netWorthDates(start: string, end: string): string[] {
  dateSchema.parse(start);
  dateSchema.parse(end);
  if (start > end) return [];
  const dates = [start];
  const cursor = new Date(start + "T00:00:00Z");
  cursor.setUTCMonth(cursor.getUTCMonth() + 1, 0);
  while (cursor.toISOString().slice(0, 10) < end && dates.length < 61) {
    const date = cursor.toISOString().slice(0, 10);
    if (date !== start) dates.push(date);
    cursor.setUTCMonth(cursor.getUTCMonth() + 2, 0);
  }
  if (dates.length >= 61)
    throw new Error("净资产趋势最多查看五年，请缩短时间范围。");
  if (end !== start) dates.push(end);
  return dates;
}
export function netWorthSeries(
  ledger: Ledger,
  dates: string[],
  rates: Record<string, ExchangeRate[]>,
): Array<{ date: string; amount: number | null; missing: string[] }> {
  return dates.map((date) => {
    const value = summarizeAssets({
      ledger,
      through: date + " 23:59:59",
      rates: rates[date],
    });
    return {
      date,
      amount: value.missingCurrencies.length ? null : value.netAssets,
      missing: value.missingCurrencies,
    };
  });
}
export function calendarHeat(
  ledger: Ledger,
  month: string,
): Array<{
  date: string;
  expense: number;
  income: number;
  count: number;
  level: number;
}> {
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const entries = Array.from({ length: days }, (_, index) => {
    const date = month + "-" + String(index + 1).padStart(2, "0");
    const records = ledger.records.filter(
      (item) =>
        !item.isDeleted &&
        item.status === "confirmed" &&
        item.date.startsWith(date),
    );
    return { date, ...summarize(records), count: records.length };
  });
  const maximum = Math.max(
    1,
    ...entries.map((item) => Math.max(0, item.expense)),
  );
  return entries.map((item) => ({
    ...item,
    level:
      item.expense > 0
        ? Math.max(1, Math.ceil((item.expense / maximum) * 4))
        : 0,
  }));
}
