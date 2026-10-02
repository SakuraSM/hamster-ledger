import { z } from "zod";
import { isValidDate } from "./periods.js";
const TIMESTAMP_LENGTH = 19;
export function isValidDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const parsed = new Date(value.replace(" ", "T") + "Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().replace("T", " ").slice(0, TIMESTAMP_LENGTH) === value
  );
}
export const dateSchema = z.string().refine(isValidDate, "日期无效");
export const dateTimeSchema = z
  .string()
  .refine(isValidDateTime, "日期时间无效");
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "月份无效");
