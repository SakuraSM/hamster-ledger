const DATE_KEY_LENGTH = 10;
const DAY_MS = 86400000;
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, DATE_KEY_LENGTH);
}
export function isValidDate(value: string): boolean {
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && dateKey(date) === value;
}
export function addDays(value: string, days: number): string {
  return dateKey(new Date(Date.parse(value + "T00:00:00Z") + days * DAY_MS));
}
export function calendarDate(input: {
  year: number;
  month: number;
  day: number;
}): string {
  const date = new Date(0);
  date.setUTCFullYear(input.year, input.month + 1, 0);
  const last = date.getUTCDate();
  date.setUTCFullYear(input.year, input.month, Math.min(input.day, last));
  return dateKey(date);
}
export function cycleRange(
  month: string,
  startDay: number,
): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = calendarDate({ year, month: monthNumber - 1, day: startDay });
  const end = calendarDate({ year, month: monthNumber, day: startDay });
  return { start, end };
}
const MONTH_KEY_LENGTH = 7;
const PREVIOUS_MONTH_OFFSET = 2;
export function cycleMonthForDate(date: string, startDay: number): string {
  const month = date.slice(0, MONTH_KEY_LENGTH);
  if (date.slice(0, DATE_KEY_LENGTH) >= cycleRange(month, startDay).start)
    return month;
  const [year, number] = month.split("-").map(Number);
  return calendarDate({
    year,
    month: number - PREVIOUS_MONTH_OFFSET,
    day: 1,
  }).slice(0, MONTH_KEY_LENGTH);
}
