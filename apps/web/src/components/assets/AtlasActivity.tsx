import { cycleMonthForDate } from "@hamster-ledger/core";
import { useMemo } from "react";
import {
  assetActivity,
  money,
  signedMoney,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { CategoryIcon } from "../Icons";
export function AtlasActivity({
  ledger,
  date,
  hidden,
  onRecord,
  onBudget,
}: {
  onBudget?: (month: string) => void;
  ledger: Ledger;
  date: string;
  hidden: boolean;
  onRecord: (r: BillRecord) => void;
}) {
  const { budget, recent } = useMemo(
    () => assetActivity(ledger, date),
    [ledger, date],
  );
  return (
    <>
      <section className="atlas-feed">
        <h2>最近流水</h2>
        {recent.map((r) => (
          <button type="button" key={r.id} onClick={() => onRecord(r)}>
            <time>{r.date.slice(5, 10)}</time>
            <CategoryIcon
              category={r.category}
              merchant={hidden ? "" : r.merchant}
            />
            <span>{hidden ? "账单" : r.merchant || r.category}</span>
            <b>{hidden ? "••••" : signedMoney(r)}</b>
          </button>
        ))}
        {!recent.length && <p>暂无已确认流水</p>}
      </section>
      {budget ? (
        <section className="atlas-feed">
          <h2>本期预算</h2>
          <p>剩余 {hidden ? "••••" : "¥" + money(budget.remaining)}</p>
          {!hidden && budget.available > 0 && (
            <progress
              max={budget.available}
              value={Math.max(0, Math.min(budget.spent, budget.available))}
            />
          )}
          {onBudget && (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onBudget(
                  cycleMonthForDate(
                    date,
                    ledger.preferences?.cycleStartDay ?? 1,
                  ),
                )
              }
            >
              查看本期预算
            </button>
          )}
        </section>
      ) : onBudget ? (
        <section className="atlas-feed">
          <h2>本期预算</h2>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onBudget(
                cycleMonthForDate(date, ledger.preferences?.cycleStartDay ?? 1),
              )
            }
          >
            设置本期预算
          </button>
        </section>
      ) : null}
    </>
  );
}
