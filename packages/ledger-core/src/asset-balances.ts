import { ACCOUNT_KINDS, type AssetAccount } from "./account-model.js";
import { resolveAssetAccount } from "./account-links.js";
import { RECORD_STATUS, type BillRecord, type Ledger } from "./model.js";
export interface AccountBalance {
  account: AssetAccount;
  balance: number;
  change: number;
  movementCount: number;
}
export function accountMovement(input: {
  record: BillRecord;
  account: AssetAccount;
  accounts: AssetAccount[];
}): number {
  const { record, account, accounts } = input;
  if (record.isDeleted || record.status !== RECORD_STATUS.CONFIRMED) return 0;
  if (record.detail?.movements.length)
    return record.detail.movements
      .filter((movement) => movement.accountId === account.id)
      .reduce((sum, movement) => sum + movement.amount, 0);
  const source = resolveAssetAccount(record, accounts);
  const isSource = source?.id === account.id;
  const isLiability = account.kind === ACCOUNT_KINDS.LIABILITY;
  if (record.kind === "转账") {
    const destination = accounts.find(
      (item) => item.id === record.transferToAccountId,
    );
    if (!source || !destination || source.id === destination.id) return 0;
    if (isSource) return isLiability ? record.amount : -record.amount;
    if (destination.id === account.id)
      return isLiability ? -record.amount : record.amount;
    return 0;
  }
  if (!isSource) return 0;
  if (record.kind === "支出")
    return isLiability ? record.amount : -record.amount;
  if (record.kind === "收入" || record.kind === "退款")
    return isLiability ? -record.amount : record.amount;
  return 0;
}
export function projectAccountBalance(input: {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
}): AccountBalance {
  const { account, ledger, through } = input;
  let change = 0;
  let movementCount = 0;
  for (const record of ledger.records) {
    if (record.date <= account.balanceAt || record.date > through) continue;
    const movement = accountMovement({
      record,
      account,
      accounts: ledger.accounts,
    });
    change += movement;
    if (movement !== 0) movementCount++;
  }
  return {
    account,
    balance: account.openingBalance + change,
    change,
    movementCount,
  };
}
export function summarizeAssets(input: { ledger: Ledger; through: string }): {
  assets: number;
  liabilities: number;
  netAssets: number;
  balances: AccountBalance[];
} {
  const balances = input.ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => projectAccountBalance({ ...input, account }));
  let assets = 0;
  let liabilities = 0;
  for (const projection of balances) {
    const signedValue =
      projection.account.kind === ACCOUNT_KINDS.ASSET
        ? projection.balance
        : -projection.balance;
    if (signedValue >= 0) assets += signedValue;
    else liabilities -= signedValue;
  }
  return { assets, liabilities, netAssets: assets - liabilities, balances };
}
