const TWO_DIGITS = 2;
const CENTS_PER_YUAN = 100;
const LAST_HOUR = 23;
const LAST_MINUTE_OR_SECOND = 59;
export function parseAmount(value: string): number | null {
  const clean = value.replace(/[,，¥￥\s]/g, "");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.replace(/^[+-]/, "").split(".");
  const cents =
    Number(whole) * CENTS_PER_YUAN + Number(fraction.padEnd(TWO_DIGITS, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function parseDate(value: string): string | null {
  const normalized = value
    .trim()
    .replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")
    .replace(/[年/\.]/g, "-")
    .replace("月", "-")
    .replace("日", "")
    .replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    Number(hour) > LAST_HOUR ||
    Number(minute) > LAST_MINUTE_OR_SECOND ||
    Number(second) > LAST_MINUTE_OR_SECOND
  )
    return null;
  return `${year}-${month.padStart(TWO_DIGITS, "0")}-${day.padStart(TWO_DIGITS, "0")} ${hour.padStart(TWO_DIGITS, "0")}:${minute}:${second}`;
}
