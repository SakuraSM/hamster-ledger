import { dateTimeSchema } from "./date-schemas.js";
const MAX_ACCOUNT_NAME_LENGTH = 60;
import { z } from "zod";
import { currencySchema } from "./currency.js";
export const ACCOUNT_KINDS = {
  ASSET: "asset",
  LIABILITY: "liability",
} as const;
export const ASSET_TYPES = [
  "银行卡",
  "现金",
  "网络钱包",
  "投资",
  "其他资产",
  "应收款",
  "储值卡",
  "固定资产",
] as const;
export const LIABILITY_TYPES = [
  "信用卡",
  "贷款",
  "其他负债",
  "应付款",
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[keyof typeof ACCOUNT_KINDS];
export const balanceCheckpointSchema = z.object({
  id: z.string(),
  balance: z.number().int(),
  at: dateTimeSchema,
  note: z.string(),
  recordedAt: dateTimeSchema,
});
export const assetAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_ACCOUNT_NAME_LENGTH),
  kind: z.enum(["asset", "liability"]),
  type: z.enum([...ASSET_TYPES, ...LIABILITY_TYPES]),
  openingBalance: z.number().int(),
  balanceAt: dateTimeSchema,
  aliases: z.array(z.string()).default([]),
  isArchived: z.boolean().default(false),
  checkpoints: z.array(balanceCheckpointSchema).default([]),
  currency: currencySchema.optional(),
  creditLimit: z.number().int().safe().nonnegative().optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
});
export type AssetAccount = z.infer<typeof assetAccountSchema>;
