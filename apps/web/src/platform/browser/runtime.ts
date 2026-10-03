const TWO_DIGITS = 2;
export function localNow(): string {
  const date = new Date();
  const pad = (value: number): string =>
    String(value).padStart(TWO_DIGITS, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function newEntityId(): string {
  return crypto.randomUUID();
}
