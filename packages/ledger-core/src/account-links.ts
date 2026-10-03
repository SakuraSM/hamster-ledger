import type { AssetAccount } from "./account-model.js";
import type { BillRecord } from "./model.js";
export const UNASSIGNED_ACCOUNT_FILTER = "unassigned";
export function normalizeAccountLabel(value: string): string {
  return value
    .trim()
    .replace(/[\s·•()（）]/g, "")
    .toLowerCase();
}
export function resolveAssetAccount(
  record: BillRecord,
  accounts: AssetAccount[],
): AssetAccount | undefined {
  if (record.accountId === null) return undefined;
  if (record.accountId !== undefined)
    return accounts.find((account) => account.id === record.accountId);
  const label = normalizeAccountLabel(record.account);
  if (!label) return undefined;
  const matches = accounts.filter(
    (account) =>
      !account.isArchived &&
      [account.name, ...account.aliases].some(
        (alias) => normalizeAccountLabel(alias) === label,
      ),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function linkedAccountRecords(input: {
  records: BillRecord[];
  accounts: AssetAccount[];
  accountId: string;
}): BillRecord[] {
  return input.records.filter(
    (record) =>
      resolveAssetAccount(record, input.accounts)?.id === input.accountId ||
      record.transferToAccountId === input.accountId,
  );
}
export function linkRecognizedAccounts(
  records: BillRecord[],
  accounts: AssetAccount[],
): BillRecord[] {
  return records.map((record) => {
    if (record.accountId !== undefined) return record;
    const account = resolveAssetAccount(record, accounts);
    return account ? { ...record, accountId: account.id } : record;
  });
}
