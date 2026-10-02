import { dateSchema, monthSchema } from "./date-schemas.js";
const MAX_CATEGORY_LENGTH = 30;
const MAX_CYCLE_START_DAY = 31;
const MAX_BOOK_NAME_LENGTH = 40;
import { z } from "zod";
export const categoryDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(MAX_CATEGORY_LENGTH),
  kind: z.enum(["支出", "收入"]),
  order: z.number().int(),
  isArchived: z.boolean().optional(),
});
export const budgetSchema = z.object({
  id: z.string(),
  month: monthSchema,
  category: z.string().nullable(),
  amount: z.number().int().positive(),
});
export const recurringRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  merchant: z.string().min(1),
  amount: z.number().int().positive(),
  kind: z.enum(["支出", "收入", "转账"]),
  category: z.string(),
  accountId: z.string().nullable(),
  transferToAccountId: z.string().nullable().optional(),
  description: z.string(),
  tags: z.array(z.string()),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  startDate: dateSchema,
  endDate: dateSchema.or(z.literal("")).optional(),
  isPaused: z.boolean(),
});
export const preferencesSchema = z.object({
  cycleStartDay: z.number().int().min(1).max(MAX_CYCLE_START_DAY).default(1),
  hideAmounts: z.boolean().default(false),
  theme: z.enum(["warm", "sage", "night"]).default("warm"),
  reminderTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .default("21:00"),
  reminderEnabled: z.boolean().default(false),
});
export type CategoryDefinition = z.infer<typeof categoryDefinitionSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type RecurringRule = z.infer<typeof recurringRuleSchema>;
export type LedgerPreferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES: LedgerPreferences = {
  cycleStartDay: 1,
  hideAmounts: false,
  theme: "warm",
  reminderTime: "21:00",
  reminderEnabled: false,
};
export const bookSchema = z.object({
  id: z.union([
    z.literal("demo"),
    z.literal("personal"),
    z.string().regex(/^book:[A-Za-z0-9-]+$/),
  ]),
  name: z.string().trim().min(1).max(MAX_BOOK_NAME_LENGTH),
  isArchived: z.boolean().optional(),
});
export type Book = z.infer<typeof bookSchema>;
export const DEFAULT_BOOKS: Book[] = [
  { id: "demo", name: "示例账本" },
  { id: "personal", name: "我的账本" },
];
