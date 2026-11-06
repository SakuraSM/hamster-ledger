import {
  accountActiveAt,
  convertToCny,
  dateSchema,
  dateTimeSchema,
  parseMinor,
  projectAccountBalance,
  type AssetAccount,
  type Currency,
  type Ledger,
} from "@hamster-ledger/core";
import type { EntryDraft } from "@hamster-ledger/ledger-react";

const DATE_LENGTH = 10;

type RepaymentPreview =
  | { message: string }
  | {
      sourceBefore: number;
      sourceAfter: number;
      targetBefore: number;
      targetAfter: number;
    };

function repaymentAmount(draft: EntryDraft, currency: Currency): number | null {
  try {
    const minor = parseMinor({ value: draft.amount, currency });
    const destinationMinor = draft.destinationAmount
      ? parseMinor({ value: draft.destinationAmount, currency })
      : minor;
    const rate = currency === "CNY" ? "1" : draft.rate;
    if (
      minor <= 0 ||
      minor !== destinationMinor ||
      (currency !== "CNY" &&
        (!dateSchema.safeParse(draft.rateDate).success ||
          draft.rateDate > draft.date.slice(0, DATE_LENGTH))) ||
      convertToCny({ minor, currency, rate }) <= 0
    )
      return null;
    return minor;
  } catch {
    // Incomplete amount and rate fields are validated on submission.
    return null;
  }
}

export function repaymentPreview(input: {
  ledger: Ledger;
  account: AssetAccount | undefined;
  draft: EntryDraft;
  needsRateConfirmation: boolean;
}): RepaymentPreview | null {
  const { ledger, account, draft, needsRateConfirmation } = input;
  if (account?.kind !== "liability" || !draft.accountId || !draft.amount)
    return null;
  const source = ledger.accounts.find(
    (item) =>
      item.id === draft.accountId && !item.isArchived && item.kind === "asset",
  );
  const target = ledger.accounts.find(
    (item) =>
      item.id === draft.destinationId &&
      !item.isArchived &&
      item.kind === "liability",
  );
  if (!source || !target || target.id !== account.id)
    return { message: "请选择有效账户后再预览。" };
  const currency = source.currency ?? "CNY";
  if (currency !== (target.currency ?? "CNY"))
    return { message: "跨币种还款无法预览余额，请填写实际转入金额。" };
  if (!dateTimeSchema.safeParse(draft.date).success || needsRateConfirmation)
    return null;
  if (
    !accountActiveAt(source, draft.date) ||
    !accountActiveAt(target, draft.date)
  )
    return { message: "还款时间有账户已归档，无法预览余额。" };
  const minor = repaymentAmount(draft, currency);
  if (minor === null) return null;
  const sourceProjection = projectAccountBalance({
    ledger,
    account: source,
    through: draft.date,
  });
  const targetProjection = projectAccountBalance({
    ledger,
    account: target,
    through: draft.date,
  });
  if (
    !sourceProjection.baseline ||
    !targetProjection.baseline ||
    draft.date <= sourceProjection.baseline.at ||
    draft.date <= targetProjection.baseline.at
  )
    return { message: "还款时间缺少有效余额基准，无法预览余额。" };
  const sourceAfter = sourceProjection.balance - minor;
  const targetAfter = targetProjection.balance - minor;
  if (!Number.isSafeInteger(sourceAfter) || !Number.isSafeInteger(targetAfter))
    return { message: "金额超出可预览范围。" };
  return {
    sourceBefore: sourceProjection.balance,
    sourceAfter,
    targetBefore: targetProjection.balance,
    targetAfter,
  };
}
