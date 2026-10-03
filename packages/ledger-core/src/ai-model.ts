import { z } from "zod";
import { currencySchema } from "./currency.js";
import { TRANSACTION_TYPES } from "./finance-model.js";

export const aiCandidateSchema = z.object({
  type: z.enum(TRANSACTION_TYPES).default("expense"),
  amount: z.string().max(60).default(""),
  currency: currencySchema.default("CNY"),
  date: z.string().max(40).default(""),
  merchant: z.string().max(200).default(""),
  category: z.string().max(80).default("待分类"),
  accountId: z.string().nullable().default(null),
  description: z.string().max(4000).default(""),
  confidence: z.number().min(0).max(1).default(0),
  issues: z.array(z.string().max(200)).max(30).default([]),
});
export type AiCandidate = z.infer<typeof aiCandidateSchema>;
export const aiDraftSchema = z.object({
  id: z.string().min(1),
  sourceHash: z.string().min(1),
  source: z.enum(["text-rule", "model-text", "model-image"]),
  sourceLabel: z.string().max(300),
  memberId: z.string().optional(),
  createdAt: z.string(),
  attachmentIds: z.array(z.string()).max(10).default([]),
  candidate: aiCandidateSchema,
  state: z.enum(["pending", "confirmed", "discarded"]).default("pending"),
  recordId: z.string().optional(),
});
export type AiDraft = z.infer<typeof aiDraftSchema>;
