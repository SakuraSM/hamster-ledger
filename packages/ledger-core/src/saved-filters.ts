import { z } from "zod";
import { KINDS, SOURCES } from "./model.js";
const text = z.string().max(500).default("");
export const savedTransactionFilterSchema = z.object({
  query: text,
  source: z.union([z.enum(SOURCES), z.literal("")]).default(""),
  category: text,
  accountId: text,
  memberId: text,
  reimbursement: z
    .enum(["", "pending", "partial", "settled", "none"])
    .default(""),
  kind: z.union([z.enum(KINDS), z.literal("")]).default(""),
  status: z.enum(["", "confirmed", "pending", "duplicate"]).default(""),
  isDeleted: z.boolean().default(false),
  startDate: text,
  endDate: text,
});
export const savedViewSchema = z.object({
  filter: savedTransactionFilterSchema,
  position: z.number().int().nonnegative().max(10000000).default(0),
});
export const savedFiltersSchema = z.object({
  version: z.literal(1),
  last: savedViewSchema.optional(),
  presets: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        filter: savedTransactionFilterSchema,
      }),
    )
    .max(20),
});
export type SavedTransactionFilter = z.infer<
  typeof savedTransactionFilterSchema
>;
export type SavedTransactionView = z.infer<typeof savedViewSchema>;
export type SavedFilters = z.infer<typeof savedFiltersSchema>;
