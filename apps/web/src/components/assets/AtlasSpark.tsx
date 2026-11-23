import { useMemo } from "react";
import { monthPreview, type Ledger } from "@hamster-ledger/core";
export function AtlasSpark({
  ledger,
  date,
  onOpen,
}: {
  ledger: Ledger;
  date: string;
  onOpen: () => void;
}) {
  const path = useMemo(() => monthPreview(ledger, date), [ledger, date]);
  if (!path) return null;
  return (
    <button
      type="button"
      className="atlas-spark"
      onClick={onOpen}
      aria-label="展开本月净资产走势"
    >
      <svg viewBox="0 0 100 38" aria-hidden="true">
        <path d={path} />
        <path className="atlas-trace" d={path} pathLength={100} />
      </svg>
      <small>本月走势</small>
    </button>
  );
}
