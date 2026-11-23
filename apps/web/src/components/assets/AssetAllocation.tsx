import { CompositionMap } from "./CompositionMap";
import { useState } from "react";
import {
  allocationRows,
  allocationGroups,
  money,
  type summarizeAssets,
} from "@hamster-ledger/core";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
export function AssetAllocation({
  totals,
  hidden,
  onAccount,
}: {
  totals: ReturnType<typeof summarizeAssets>;
  hidden: boolean;
  onAccount: (id: string) => void;
}) {
  const [rank, setRank] = useState(false);
  const [mode, setMode] = useState<"资产" | "负债" | "净资产">("资产");
  const liability = mode === "负债",
    total = liability ? totals.liabilities : totals.assets;
  const rows = allocationRows(totals.balances, liability),
    groups = allocationGroups(rows);
  const partial =
    totals.missingBaselines.length + totals.missingCurrencies.length > 0;
  return (
    <section className="atlas-allocation">
      <header>
        <h2>{mode === "净资产" ? "资产与负债" : mode + "构成"}</h2>
        <div role="group" aria-label="资产分析口径">
          {(["资产", "负债", "净资产"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === mode}
              onClick={() => setMode(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </header>
      {hidden ? (
        <p>金额与占比已隐藏</p>
      ) : mode === "净资产" ? (
        <p>
          资产负债率{" "}
          <strong>
            {total && !partial
              ? ((100 * totals.liabilities) / total).toFixed(1) + "%"
              : "—"}
          </strong>
        </p>
      ) : total > 0 ? (
        <>
          <CompositionMap groups={groups} />
          <div className="atlas-band" aria-hidden="true">
            {groups.map((g, i) => (
              <i
                key={g.label}
                style={{
                  flex: g.value,
                  backgroundColor:
                    tokens.chart.categories[i % tokens.chart.categories.length],
                }}
              />
            ))}
          </div>
          <ul>
            {groups.map((g) => (
              <li key={g.label}>
                {g.label} <b>{((100 * g.value) / total).toFixed(1)}%</b>
              </li>
            ))}
          </ul>
          <details onToggle={(e) => setRank(e.currentTarget.open)}>
            <summary>{mode}账户排行</summary>
            {rank &&
              rows.map((r) => (
                <button
                  className="atlas-rank"
                  type="button"
                  key={r.account.id}
                  onClick={() => onAccount(r.account.id)}
                >
                  {r.account.name}
                  <b>¥{money(r.value)}</b>
                </button>
              ))}
          </details>
        </>
      ) : (
        <p>{partial ? "估值待补全" : "暂无" + mode + "余额"}</p>
      )}
      {partial && !hidden && <small>仅统计有基准和汇率的账户</small>}
    </section>
  );
}
