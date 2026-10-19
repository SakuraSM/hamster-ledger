import { accountActiveAt } from "./account-model.js";
import { accountBaselines } from "./account-baselines.js";
import { accountMovement } from "./asset-balances.js";
import { normalizeAccountLabel } from "./account-links.js";
import type { AssetAccount } from "./account-model.js";
import type { Ledger } from "./model.js";

const MAX_TOTAL = BigInt(Number.MAX_SAFE_INTEGER);
interface Movement {
  date: string;
  amount: bigint;
}
function assertRange(value: bigint): void {
  if (value > MAX_TOTAL || value < -MAX_TOTAL)
    throw new Error("账户累计金额超过安全范围，请核对余额与流水。");
}

/** Bound every baseline interval, including historical and partially selected dates. */
export function validateAccountMoney(ledger: Ledger): void {
  const accounts = new Map(
    ledger.accounts.map((account) => [account.id, account]),
  );
  const aliases = new Map<string, AssetAccount | null>();
  for (const account of ledger.accounts) {
    if (account.isArchived) continue;
    for (const label of new Set(
      [account.name, ...account.aliases].map(normalizeAccountLabel),
    )) {
      const key = `${account.currency ?? "CNY"}:${label}`;
      aliases.set(key, aliases.has(key) ? null : account);
    }
  }
  const movements = new Map<string, Movement[]>();
  function add(id: string, movement: Movement): void {
    const items = movements.get(id) ?? [];
    items.push(movement);
    movements.set(id, items);
  }
  for (const record of ledger.records) {
    if (record.isDeleted || record.status !== "confirmed") continue;
    if (record.detail?.movements.length) {
      for (const movement of record.detail.movements)
        add(movement.accountId, {
          date: record.date,
          amount: BigInt(movement.amount),
        });
      continue;
    }
    const source =
      record.accountId === undefined
        ? aliases.get(
            `${record.detail?.original.currency ?? "CNY"}:${normalizeAccountLabel(record.account)}`,
          )
        : record.accountId === null
          ? undefined
          : accounts.get(record.accountId);
    const destination = accounts.get(record.transferToAccountId ?? "");
    const related = [...new Set([source, destination])].filter(
      (account): account is AssetAccount => !!account,
    );
    // Explicit resolution retains ambiguity/null semantics while avoiding full account scans.
    const resolved = { ...record, accountId: source?.id ?? null };
    for (const account of related)
      add(account.id, {
        date: record.date,
        amount: BigInt(
          accountMovement({ record: resolved, account, accounts: related }),
        ),
      });
  }
  const valuations: Array<{ date: string; id: string; balance?: bigint }> = [];
  for (const account of ledger.accounts) {
    const baselines = accountBaselines(account);
    const changes = (movements.get(account.id) ?? []).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    let cursor = 0;
    let maximum = 0n;
    let minimum = 0n;
    for (let index = 0; index < baselines.length; index++) {
      const baseline = baselines[index];
      let positive = 0n;
      let negative = 0n;
      let balance = BigInt(baseline.balance);
      const isValued =
        (!account.isArchived || !!account.archiveHistory?.length) &&
        (account.currency ?? "CNY") === "CNY";
      const sign = account.kind === "asset" ? 1n : -1n;
      if (isValued)
        valuations.push({
          date: baseline.at,
          id: account.id,
          balance: balance * sign,
        });
      while (cursor < changes.length && changes[cursor].date <= baseline.at)
        cursor++;
      while (
        cursor < changes.length &&
        (!baselines[index + 1] ||
          changes[cursor].date < baselines[index + 1].at)
      ) {
        const movement = changes[cursor++];
        const change = movement.amount;
        if (change > 0n) positive += change;
        else negative += change;
        balance += change;
        if (isValued)
          valuations.push({
            date: movement.date,
            id: account.id,
            balance: balance * sign,
          });
      }
      assertRange(positive);
      assertRange(negative);
      const upper = BigInt(baseline.balance) + positive;
      const lower = BigInt(baseline.balance) + negative;
      assertRange(upper);
      assertRange(lower);
      maximum = upper > maximum ? upper : maximum;
      minimum = lower < minimum ? lower : minimum;
    }
    if ((account.currency ?? "CNY") === "CNY")
      for (const event of account.archiveHistory ?? [])
        valuations.push({ date: event.at, id: account.id });
    // Account comparison can subtract any two supported historical balances.
    assertRange(maximum - minimum);
  }
  const current = new Map<string, bigint>();
  const rawBalances = new Map<string, bigint>();
  let assets = 0n;
  let liabilities = 0n;
  let minimumNet = 0n;
  let maximumNet = 0n;
  valuations.sort((left, right) => left.date.localeCompare(right.date));
  for (let index = 0; index < valuations.length; index++) {
    const valuation = valuations[index];
    const previous = current.get(valuation.id) ?? 0n;
    if (valuation.balance !== undefined)
      rawBalances.set(valuation.id, valuation.balance);
    const balance = accountActiveAt(accounts.get(valuation.id)!, valuation.date)
      ? (rawBalances.get(valuation.id) ?? 0n)
      : 0n;
    assets += (balance > 0n ? balance : 0n) - (previous > 0n ? previous : 0n);
    liabilities +=
      (balance < 0n ? -balance : 0n) - (previous < 0n ? -previous : 0n);
    current.set(valuation.id, balance);
    if (valuations[index + 1]?.date === valuation.date) continue;
    assertRange(assets);
    assertRange(liabilities);
    const net = assets - liabilities;
    minimumNet = net < minimumNet ? net : minimumNet;
    maximumNet = net > maximumNet ? net : maximumNet;
    assertRange(maximumNet - minimumNet);
  }
}
