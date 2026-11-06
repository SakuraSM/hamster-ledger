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

interface RepaymentPreview {
  sourceBalance: number;
  targetBalance: number;
}

export function repaymentPreview({
  ledger,
  isRepayment,
  sourceAccount,
  targetAccount,
  currency,
  destinationCurrency,
  draft,
  needsRateConfirmation,
}: {
  ledger: Ledger;
  isRepayment: boolean;
  sourceAccount: AssetAccount | undefined;
  targetAccount: AssetAccount | undefined;
  currency: Currency;
  destinationCurrency: Currency;
  draft: EntryDraft;
  needsRateConfirmation: boolean;
}): { preview: RepaymentPreview | null; isArchivedAtRepayment: boolean } {
  const isValidDate = dateTimeSchema.safeParse(draft.date).success;
  const isArchivedAtRepayment = Boolean(
    isRepayment &&
    sourceAccount &&
    targetAccount &&
    isValidDate &&
    (!accountActiveAt(sourceAccount, draft.date) ||
      !accountActiveAt(targetAccount, draft.date)),
  );
  let preview: { sourceBalance: number; targetBalance: number } | null = null;
  if (
    isRepayment &&
    sourceAccount &&
    targetAccount &&
    currency === destinationCurrency &&
    draft.amount &&
    isValidDate &&
    !isArchivedAtRepayment &&
    !needsRateConfirmation
  ) {
    try {
      const minor = parseMinor({ value: draft.amount, currency });
      const destinationMinor = draft.destinationAmount
        ? parseMinor({ value: draft.destinationAmount, currency })
        : minor;
      const sourceProjection = projectAccountBalance({
        ledger,
        account: sourceAccount,
        through: draft.date,
      });
      const targetProjection = projectAccountBalance({
        ledger,
        account: targetAccount,
        through: draft.date,
      });
      if (
        minor > 0 &&
        minor === destinationMinor &&
        (currency === "CNY" ||
          (dateSchema.safeParse(draft.rateDate).success &&
            draft.rateDate <= draft.date.slice(0, DATE_LENGTH))) &&
        convertToCny({
          minor,
          currency,
          rate: currency === "CNY" ? "1" : draft.rate,
        }) > 0 &&
        sourceProjection.baseline &&
        targetProjection.baseline &&
        draft.date > sourceProjection.baseline.at &&
        draft.date > targetProjection.baseline.at &&
        Number.isSafeInteger(sourceProjection.balance - minor) &&
        Number.isSafeInteger(targetProjection.balance - minor)
      ) {
        preview = {
          sourceBalance: sourceProjection.balance - minor,
          targetBalance: targetProjection.balance - minor,
        };
      }
    } catch {
      // Incomplete input is validated when the user submits the form.
    }
  }
  return { preview, isArchivedAtRepayment };
}
