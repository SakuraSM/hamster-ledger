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
  balance: z.number().int().safe(),
  at: dateTimeSchema,
  note: z.string(),
  recordedAt: dateTimeSchema,
});
export const assetAccountSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(MAX_ACCOUNT_NAME_LENGTH),
    kind: z.enum(["asset", "liability"]),
    type: z.enum([...ASSET_TYPES, ...LIABILITY_TYPES]),
    openingBalance: z.number().int().safe(),
    balanceAt: dateTimeSchema,
    aliases: z.array(z.string()).default([]),
    isArchived: z.boolean().default(false),
    archiveHistory: z
      .array(z.object({ at: dateTimeSchema, isArchived: z.boolean() }))
      .max(1000)
      .optional(),
    checkpoints: z.array(balanceCheckpointSchema).default([]),
    currency: currencySchema.optional(),
    creditLimit: z.number().int().safe().nonnegative().optional(),
    statementDay: z.number().int().min(1).max(31).optional(),
    paymentDay: z.number().int().min(1).max(31).optional(),
  })
  .superRefine((account, context) => {
    const history = account.archiveHistory;
    if (
      history?.length &&
      (history.at(-1)?.isArchived !== account.isArchived ||
        history.some(
          (event, index) => index > 0 && event.at < history[index - 1].at,
        ))
    )
      context.addIssue({
        code: "custom",
        path: ["archiveHistory"],
        message: "账户归档历史顺序或最终状态不一致。",
      });
  });
export type AssetAccount = z.infer<typeof assetAccountSchema>;

/** Legacy archives have no dated history; retain their existing exclusion. */
export function accountActiveAt(
  account: AssetAccount,
  through: string,
): boolean {
  const history = account.archiveHistory;
  if (!history?.length) return !account.isArchived;
  let low = 0;
  let high = history.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (history[middle].at <= through) low = middle + 1;
    else high = middle;
  }
  return low ? !history[low - 1].isArchived : history[0].isArchived;
}
