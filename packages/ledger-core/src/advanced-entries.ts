import { z } from "zod";
import { type Ledger, type Kind, recordSchema } from "./model.js";
import { type AssetAccount } from "./account-model.js";
import {
  transactionDetailSchema,
  type TransactionDetail,
} from "./finance-model.js";
import { originalMoneySchema, convertToCny } from "./currency.js";
import { dateTimeSchema } from "./date-schemas.js";
import { migrateLedger } from "./migration.js";

export const advancedEntrySchema = z.object({
  id: z.string().min(1),
  date: dateTimeSchema,
  merchant: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(""),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  accountId: z.string().min(1),
  transferToAccountId: z.string().nullable().default(null),
  detail: transactionDetailSchema,
  adjustmentSign: z.union([z.literal(1), z.literal(-1)]).default(1),
});
export type AdvancedEntryInput = z.input<typeof advancedEntrySchema>;
const TRANSFER_TYPES = new Set<TransactionDetail["type"]>([
  "transfer",
  "lend",
  "borrow",
  "repay_receive",
  "repay_pay",
  "invest_buy",
  "invest_sell",
]);
const KIND_BY_TYPE: Record<TransactionDetail["type"], Kind> = {
  expense: "支出",
  income: "收入",
  fee: "支出",
  interest: "收入",
  refund: "退款",
  reimburse: "退款",
  transfer: "转账",
  lend: "转账",
  borrow: "转账",
  repay_receive: "转账",
  repay_pay: "转账",
  invest_buy: "转账",
  invest_sell: "转账",
  adjust: "不计收支",
  excluded: "不计收支",
};
function activeAccount(ledger: Ledger, id: string): AssetAccount {
  const account = ledger.accounts.find(
    (item) => item.id === id && !item.isArchived,
  );
  if (!account) throw new Error("请选择存在且未归档的账户。");
  return account;
}
function signedMovement(input: {
  account: AssetAccount;
  minor: number;
  direction: number;
}): { accountId: string; amount: number } {
  return {
    accountId: input.account.id,
    amount:
      input.minor *
      input.direction *
      (input.account.kind === "liability" ? -1 : 1),
  };
}
function validateRefund(input: {
  ledger: Ledger;
  entry: z.output<typeof advancedEntrySchema>;
  baseAmount: number;
}): void {
  const { ledger, entry, baseAmount } = input;
  const detail = entry.detail;
  if (detail.type === "reimburse" && !detail.relatedId)
    throw new Error("报销回款必须关联原支出。");
  if (!detail.relatedId || !["reimburse", "refund"].includes(detail.type))
    return;
  const original = ledger.records.find(
    (record) =>
      record.id === detail.relatedId &&
      !record.isDeleted &&
      record.status === "confirmed" &&
      record.kind === "支出",
  );
  if (!original) throw new Error("关联的原支出不存在。");
  const returned = ledger.records
    .filter(
      (record) =>
        record.id !== entry.id &&
        !record.isDeleted &&
        record.status === "confirmed" &&
        record.kind === "退款" &&
        record.detail?.relatedId === original.id,
    )
    .reduce((sum, record) => sum + record.amount, 0);
  if (returned + baseAmount > original.amount)
    throw new Error("退款和报销累计金额不能超过原支出。");
}
export function saveAdvancedEntry(
  ledger: Ledger,
  raw: AdvancedEntryInput,
): Ledger {
  const entry = advancedEntrySchema.parse(raw);
  const detail = entry.detail;
  const original = originalMoneySchema.parse(detail.original);
  if (original.minor <= 0) throw new Error("金额必须大于零。");
  if (original.currency === "CNY" && original.rate !== "1")
    throw new Error("人民币汇率必须为 1。");
  if (original.date > entry.date.slice(0, 10))
    throw new Error("记账汇率日期不能晚于交易日期。");
  const account = activeAccount(ledger, entry.accountId);
  if ((account.currency ?? "CNY") !== original.currency)
    throw new Error("原币种必须与账户币种一致。");
  const baseAmount = convertToCny(original);
  if (baseAmount <= 0) throw new Error("折算金额不足一分，请核对金额与汇率。");
  const previous = ledger.records.find((record) => record.id === entry.id);
  if (
    previous &&
    (previous.isDeleted ||
      previous.status !== "confirmed" ||
      ledger.records.some((item) => item.duplicateOf === previous.id))
  )
    throw new Error("关联或待核对账单不能直接覆盖。");
  validateRefund({ ledger, entry, baseAmount });
  if (detail.splits.length) {
    if (
      detail.type !== "expense" ||
      new Set(detail.splits.map((split) => split.memberId)).size !==
        detail.splits.length ||
      detail.splits.reduce((sum, split) => sum + split.amount, 0) !== baseAmount
    )
      throw new Error("分摊必须是支出且各成员不重复，合计须等于账单金额。");
  }
  const isTransfer = TRANSFER_TYPES.has(detail.type);
  let movements: TransactionDetail["movements"];
  if (isTransfer) {
    const destination = activeAccount(ledger, entry.transferToAccountId ?? "");
    if (destination.id === account.id)
      throw new Error("转出和转入账户不能相同。");
    const targetMoney = detail.destination ?? original;
    if ((destination.currency ?? "CNY") !== targetMoney.currency)
      throw new Error("请填写转入账户的实际币种和金额。");
    if (targetMoney.minor <= 0) throw new Error("转入金额必须大于零。");
    movements = [
      signedMovement({ account, minor: original.minor, direction: -1 }),
      signedMovement({
        account: destination,
        minor: targetMoney.minor,
        direction: 1,
      }),
    ];
  } else {
    const direction =
      detail.type === "adjust"
        ? entry.adjustmentSign
        : ["expense", "fee"].includes(detail.type)
          ? -1
          : 1;
    movements =
      detail.type === "excluded"
        ? []
        : [signedMovement({ account, minor: original.minor, direction })];
  }
  const record = recordSchema.parse({
    ...previous,
    id: entry.id,
    date: entry.date,
    merchant: entry.merchant,
    description: entry.description,
    amount: baseAmount,
    currency: "CNY",
    kind: KIND_BY_TYPE[detail.type],
    category: entry.category,
    tags: entry.tags,
    account: account.name,
    accountId: account.id,
    transferToAccountId: isTransfer ? entry.transferToAccountId : null,
    source: previous?.source ?? "手动记账",
    sourceStatus: "已确认",
    fileName: previous?.fileName ?? "手动记账",
    orderId: previous?.orderId ?? "",
    raw: previous?.raw ?? {},
    linkedSources: previous?.linkedSources ?? [],
    status: "confirmed",
    detail: { ...detail, movements },
  });
  return {
    ...migrateLedger(ledger),
    records: previous
      ? ledger.records.map((item) => (item.id === record.id ? record : item))
      : [...ledger.records, record],
  };
}

export function splitAmount(input: {
  amount: number;
  members: Array<{ id: string; weight: number }>;
}): Array<{ memberId: string; amount: number }> {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    !input.members.length ||
    new Set(input.members.map((member) => member.id)).size !==
      input.members.length
  )
    throw new Error("分摊金额或成员无效。");
  if (
    input.members.some(
      (member) => !Number.isSafeInteger(member.weight) || member.weight <= 0,
    )
  )
    throw new Error("分摊比例须为正整数。");
  const total = input.members.reduce(
    (sum, member) => sum + BigInt(member.weight),
    0n,
  );
  const shares = input.members.map((member) => ({
    memberId: member.id,
    amount: Number((BigInt(input.amount) * BigInt(member.weight)) / total),
  }));
  let remainder =
    input.amount - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of shares) if (remainder-- > 0) share.amount++;
  return shares;
}
