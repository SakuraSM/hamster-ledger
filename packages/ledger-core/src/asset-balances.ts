import {
  addMinor,
  convertToCny,
  type Currency,
  type ExchangeRate,
} from "./currency.js";
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
  const baseline = [
    { balance: account.openingBalance, at: account.balanceAt },
    ...account.checkpoints,
  ]
    .filter((item) => item.at <= through)
    .sort((left, right) => right.at.localeCompare(left.at))[0];
  if (!baseline) return { account, balance: 0, change: 0, movementCount: 0 };
  let change = 0;
  let movementCount = 0;
  for (const record of ledger.records) {
    if (record.date <= baseline.at || record.date > through) continue;
    const movement = accountMovement({
      record,
      account,
      accounts: ledger.accounts,
    });
    change = addMinor(change, movement);
    if (movement !== 0) movementCount++;
  }
  return {
    account,
    balance: addMinor(baseline.balance, change),
    change,
    movementCount,
  };
}
export function summarizeAssets(input: {
  ledger: Ledger;
  through: string;
  rates?: ExchangeRate[];
}): {
  assets: number;
  liabilities: number;
  netAssets: number;
  balances: AccountBalance[];
  missingCurrencies: Currency[];
} {
  const balances = input.ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => projectAccountBalance({ ...input, account }));
  let assets = 0;
  let liabilities = 0;
  const missingCurrencies = new Set<Currency>();
  for (const projection of balances) {
    const currency = projection.account.currency ?? "CNY";
    const rate =
      currency === "CNY"
        ? "1"
        : input.rates
            ?.filter(
              (item) =>
                item.currency === currency &&
                item.date <= input.through.slice(0, 10),
            )
            .sort((left, right) => right.date.localeCompare(left.date))[0]
            ?.rate;
    if (!rate) {
      missingCurrencies.add(currency);
      continue;
    }
    const valued = convertToCny({ minor: projection.balance, currency, rate });
    const signedValue =
      projection.account.kind === ACCOUNT_KINDS.ASSET ? valued : -valued;
    if (signedValue >= 0) assets = addMinor(assets, signedValue);
    else liabilities = addMinor(liabilities, -signedValue);
  }
  if (![assets, liabilities, assets - liabilities].every(Number.isSafeInteger))
    throw new Error("资产合计超过安全金额范围。");
  return {
    assets,
    liabilities,
    netAssets: assets - liabilities,
    balances,
    missingCurrencies: [...missingCurrencies],
  };
}
