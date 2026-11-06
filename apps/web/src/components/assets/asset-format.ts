import {
  formatCurrency,
  money,
  type AssetAccount,
  type Currency,
} from "@hamster-ledger/core";

export const HIDDEN_AMOUNT = "••••";

export function accountAmount(input: {
  minor: number;
  currency: Currency;
  isHidden: boolean;
}): string {
  return input.isHidden
    ? HIDDEN_AMOUNT
    : formatCurrency({ minor: input.minor, currency: input.currency });
}

export function cnyAmount(minor: number, isHidden: boolean): string {
  return isHidden ? HIDDEN_AMOUNT : `¥${money(minor)}`;
}

export function assetAccountLabel(input: {
  account: AssetAccount;
  accounts: AssetAccount[];
  isHidden: boolean;
}): string {
  if (!input.isHidden) return input.account.name;
  const index = input.accounts.findIndex(
    (account) => account.id === input.account.id,
  );
  const kind = input.account.kind === "liability" ? "负债账户" : "资产账户";
  return index < 0 ? kind : `${kind} ${index + 1}`;
}
