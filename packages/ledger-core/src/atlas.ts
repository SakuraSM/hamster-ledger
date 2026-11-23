import type { Ledger } from "./model.js";
import { cycleMonthForDate } from "./periods.js";
import { budgetProgress } from "./budgets.js";
import { summarizeAssets, type AccountBalance } from "./asset-balances.js";

import { addMinor } from "./currency.js";

export const valuationLabels = {
  assets: "资产",
  liabilities: "负债",
  netAssets: "净资产",
} as const;
export type ValuationMetric = keyof typeof valuationLabels;
export function allocationRows(balances: AccountBalance[], liability = false) {
  const direction = liability ? -1 : 1;
  return balances
    .flatMap(({ account, netMinor }) =>
      netMinor !== undefined && netMinor * direction > 0
        ? [{ account, value: netMinor * direction }]
        : [],
    )
    .sort((a, b) => b.value - a.value);
}
export function allocationGroups(rows: ReturnType<typeof allocationRows>) {
  const groups = new Map<string, number>();
  for (const { account, value } of rows)
    groups.set(account.type, addMinor(groups.get(account.type) ?? 0, value));
  return Array.from(groups, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value,
  );
}

/** A small, bounded within-month preview. Never use today's FX quote on a historical day. */
export function monthPreview(ledger: Ledger, date: string) {
  const day = Number(date.slice(8)),
    dates = Array.from(
      new Set(
        Array.from(
          { length: 7 },
          (_, i) => 1 + Math.round(((day - 1) * i) / 6),
        ),
      ),
    );
  const values = dates.map((d) => {
    const through = date.slice(0, 8) + String(d).padStart(2, "0") + " 23:59:59";
    const t = summarizeAssets({ ledger, through });
    return t.missingCurrencies.length ||
      t.missingBaselines.length ||
      !t.balances.length
      ? null
      : t.netAssets;
  });
  if (values.length < 2 || values.some((v) => v === null)) return "";
  const points = values as number[],
    lo = Math.min(...points),
    hi = Math.max(...points);
  return points
    .map((v, i) => {
      const x = ((dates[i] - 1) * 96) / Math.max(1, day - 1) + 2,
        y = hi === lo ? 18 : 34 - ((v - lo) * 30) / (hi - lo);
      return i === 0 ? `M${x} ${y}` : `H${x} V${y}`;
    })
    .join(" ");
}
/** Sidebar data uses the same cutoff as asset valuation. */
export function assetActivity(ledger: Ledger, date: string) {
  const through = date + " 23:59:59",
    records = ledger.records.filter((r) => r.date <= through);
  const month = cycleMonthForDate(date, ledger.preferences?.cycleStartDay ?? 1);
  const budget = budgetProgress({ ...ledger, records }, month).find(
    (b) => !b.category && (b.period ?? "monthly") === "monthly",
  );
  return {
    budget,
    recent: records
      .filter((r) => !r.isDeleted && r.status === "confirmed")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4),
  };
}
