import { summarize, type BillRecord, type Ledger } from "./model.js";
import { cycleRange } from "./periods.js";
/** Each row uses the book's cycle boundary, including cycles that span two months. */
export function statementMonths(ledger: Ledger, year: string) {
  if (!/^\d{4}$/.test(year)) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const month = year + "-" + String(i + 1).padStart(2, "0");
    const range = cycleRange(month, ledger.preferences?.cycleStartDay ?? 1);
    return {
      month,
      ...summarize(
        ledger.records.filter(
          (record) =>
            record.date.slice(0, 10) >= range.start &&
            record.date.slice(0, 10) < range.end,
        ),
      ),
    };
  });
}
export function reportWeekStart(end: string) {
  const date = new Date(end + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function dailyTotals(records: BillRecord[]) {
  const days = new Map<string, BillRecord[]>();
  for (const record of records) {
    const date = record.date.slice(0, 10);
    const day = days.get(date);
    if (day) day.push(record);
    else days.set(date, [record]);
  }
  return new Map([...days].map(([date, items]) => [date, summarize(items)]));
}
