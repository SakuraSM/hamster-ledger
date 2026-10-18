import type { AssetAccount } from "./account-model.js";

export type AccountBaseline = Pick<
  AssetAccount["checkpoints"][number],
  "id" | "balance" | "at" | "note"
>;

/** At the same effective time the last saved checkpoint wins. */
export function accountBaselines(account: AssetAccount): AccountBaseline[] {
  const byTime = new Map<string, AccountBaseline>();
  for (const checkpoint of account.checkpoints)
    byTime.set(checkpoint.at, checkpoint);
  const current = byTime.get(account.balanceAt);
  if (!current || current.balance !== account.openingBalance) {
    byTime.set(account.balanceAt, {
      id: `${account.id}:baseline:${account.balanceAt}`,
      at: account.balanceAt,
      balance: account.openingBalance,
      note: "余额基准",
    });
  }
  return [...byTime.values()].sort((left, right) =>
    left.at.localeCompare(right.at),
  );
}
