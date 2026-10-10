import {
  ASSET_TYPES,
  LIABILITY_TYPES,
  assetAccountSchema,
  type AssetAccount,
} from "./account-model.js";
import {
  linkRecognizedAccounts,
  normalizeAccountLabel,
} from "./account-links.js";
import type { Ledger } from "./model.js";
export interface SaveAssetAccountInput {
  ledger: Ledger;
  account: AssetAccount;
  now: string;
  checkpointId: string;
  note: string;
}
export function saveAssetAccount(input: SaveAssetAccountInput): Ledger {
  const parsed = assetAccountSchema.safeParse(input.account);
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "账户信息无效。");
  const account = parsed.data;
  const allowed: readonly string[] =
    account.kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES;
  if (!allowed.includes(account.type))
    throw new Error("账户类别与资产/负债类型不匹配。");
  if (account.balanceAt > input.now)
    throw new Error("余额确认时间不能晚于当前时间。");
  if (!Number.isSafeInteger(account.openingBalance))
    throw new Error("余额超过安全金额范围。");
  const previous = input.ledger.accounts.find((item) => item.id === account.id);
  if (previous && previous.kind !== account.kind)
    throw new Error("已有账户的资产/负债类型不能更改，请新增账户。");
  if (previous && (previous.currency ?? "CNY") !== (account.currency ?? "CNY"))
    throw new Error("已有账户的币种不能更改，请新增账户。");
  const labels = new Set(
    [account.name, ...account.aliases]
      .map(normalizeAccountLabel)
      .filter(Boolean),
  );
  const conflicts = input.ledger.accounts.some(
    (other) =>
      other.id !== account.id &&
      !other.isArchived &&
      [other.name, ...other.aliases].some((label) =>
        labels.has(normalizeAccountLabel(label)),
      ),
  );
  if (!account.isArchived && conflicts)
    throw new Error(
      "账户名称或别名已被其他账户使用，请填写可区分的名称或卡尾号。",
    );
  const hasBalanceChange =
    !previous ||
    previous.openingBalance !== account.openingBalance ||
    previous.balanceAt !== account.balanceAt;
  const saved: AssetAccount = {
    ...account,
    checkpoints: [
      ...(previous?.checkpoints ?? []),
      ...(hasBalanceChange
        ? [
            {
              id: input.checkpointId,
              balance: account.openingBalance,
              at: account.balanceAt,
              note: input.note || (previous ? "手动校准余额" : "创建账户"),
              recordedAt: input.now,
            },
          ]
        : []),
    ],
  };
  const accounts = previous
    ? input.ledger.accounts.map((item) => (item.id === saved.id ? saved : item))
    : [...input.ledger.accounts, saved];
  const preservedRecords = linkRecognizedAccounts(
    input.ledger.records,
    input.ledger.accounts,
  );
  return {
    ...input.ledger,
    accounts,
    records: linkRecognizedAccounts(preservedRecords, accounts),
  };
}
export function archiveAssetAccount(input: {
  ledger: Ledger;
  accountId: string;
  isArchived: boolean;
}): Ledger {
  const account = input.ledger.accounts.find(
    (item) => item.id === input.accountId,
  );
  if (!account) throw new Error("账户不存在。");
  const updated = { ...account, isArchived: input.isArchived };
  const labels = new Set(
    [updated.name, ...updated.aliases].map(normalizeAccountLabel),
  );
  if (
    !input.isArchived &&
    input.ledger.accounts.some(
      (item) =>
        !item.isArchived &&
        item.id !== updated.id &&
        [item.name, ...item.aliases].some((label) =>
          labels.has(normalizeAccountLabel(label)),
        ),
    )
  )
    throw new Error("已有账户使用相同名称或别名，请先调整账户名称。");
  return {
    ...input.ledger,
    records: linkRecognizedAccounts(
      input.ledger.records,
      input.ledger.accounts,
    ),
    accounts: input.ledger.accounts.map((item) =>
      item.id === account.id ? updated : item,
    ),
  };
}
