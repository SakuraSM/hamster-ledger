import { useState } from "react";
import {
  statementMonths,
  addMinor,
  money,
  type Ledger,
} from "@hamster-ledger/core";
export function StatementPanel({
  ledger,
  month,
  onMonth,
}: {
  ledger: Ledger;
  month: string;
  onMonth: (m: string) => void;
}) {
  const [annual, setAnnual] = useState(false);
  const amount = (n: number) =>
    ledger.preferences?.hideAmounts ? "••••" : "¥" + money(n);
  const rows = statementMonths(ledger, month.slice(0, 4)).filter(
    (row) => annual || row.month === month,
  );
  const summary = rows.reduce(
    (tot, r) => ({
      income: addMinor(tot.income, r.income),
      expense: addMinor(tot.expense, r.expense),
      net: addMinor(tot.net, r.net),
    }),
    { income: 0, expense: 0, net: 0 },
  );
  return (
    <section className="panel atlas-statements">
      <div className="section-heading">
        <h2>收支账单</h2>
        <div className="report-range-shortcuts">
          {["月账单", "年账单"].map((name, i) => (
            <button
              type="button"
              key={name}
              aria-pressed={annual === Boolean(i)}
              onClick={() => setAnnual(Boolean(i))}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {annual && (
        <p>
          {month.slice(0, 4)} 年 · 收入 {amount(summary.income)}　支出{" "}
          {amount(summary.expense)}　结余 {amount(summary.net)}
        </p>
      )}
      <table>
        <thead>
          <tr>
            {["账期", "收入", "支出", "结余"].map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => (
            <tr key={row.month}>
              <th>
                <button
                  type="button"
                  onClick={() => {
                    onMonth(row.month);
                    setAnnual(false);
                  }}
                >
                  {row.month}
                </button>
              </th>
              <td>{amount(row.income)}</td>
              <td>{amount(row.expense)}</td>
              <td>{amount(row.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
