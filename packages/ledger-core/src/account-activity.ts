import { accountBaselines } from "./account-baselines.js";
import { accountMovement } from "./asset-balances.js";
import { addMinor } from "./currency.js";
import { TRANSACTION_LABELS } from "./finance-model.js";
import type { AssetAccount } from "./account-model.js";
import type { BillRecord, Ledger } from "./model.js";

export interface AccountActivity {
  id: string;
  at: string;
  kind: "opening" | "calibration" | "record";
  label: string;
  description: string;
  change: number | null;
  balance: number;
  record?: BillRecord;
}

/** Effective history, including checkpoints; records at a checkpoint time precede its reset. */
export function accountActivity(input: {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
}): AccountActivity[] {
  const { account, ledger, through } = input;
  const baselines = accountBaselines(account).filter(
    (item) => item.at <= through,
  );
  const first = baselines[0];
  if (!first) return [];
  const events: AccountActivity[] = baselines.map((baseline, index) => ({
    id: `baseline:${baseline.id}`,
    at: baseline.at,
    kind: index === 0 ? "opening" : "calibration",
    label: index === 0 ? "建立余额基准" : "余额校准",
    description: baseline.note,
    change: null,
    balance: baseline.balance,
  }));
  for (const record of ledger.records) {
    if (record.date <= first.at || record.date > through) continue;
    const change = accountMovement({
      record,
      account,
      accounts: ledger.accounts,
    });
    if (!change) continue;
    events.push({
      id: `record:${record.id}`,
      at: record.date,
      kind: "record",
      label: record.detail
        ? TRANSACTION_LABELS[record.detail.type]
        : record.kind,
      description: record.merchant || record.description,
      change,
      balance: 0,
      record,
    });
  }
  events.sort(
    (left, right) =>
      left.at.localeCompare(right.at) ||
      Number(left.kind !== "record") - Number(right.kind !== "record") ||
      left.id.localeCompare(right.id),
  );
  let balance = first.balance;
  return events
    .map((event) => {
      if (event.kind === "record") {
        balance = addMinor(balance, event.change ?? 0);
        return { ...event, balance };
      }
      const change =
        event.kind === "opening" ? null : addMinor(event.balance, -balance);
      balance = event.balance;
      return { ...event, change };
    })
    .reverse();
}
