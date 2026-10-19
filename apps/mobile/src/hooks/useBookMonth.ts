import { useEffect, useState } from "react";
import type { LedgerMode } from "@hamster-ledger/core";
import { localNow } from "../platform/runtime";
import { MONTH_KEY_LENGTH } from "../constants";
export function useBookMonth(mode: LedgerMode) {
  const [month, setMonth] = useState("2026-09");
  useEffect(() => {
    setMonth(
      mode === "demo" ? "2026-09" : localNow().slice(0, MONTH_KEY_LENGTH),
    );
  }, [mode]);
  return [month, setMonth] as const;
}
