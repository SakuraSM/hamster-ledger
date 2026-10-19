import { useMemo } from "react";
import type { Ledger } from "@hamster-ledger/core";
const NOTE_SUGGESTION_LIMIT = 12;
export function useEntrySuggestions(ledger: Ledger): string[] {
  return useMemo(
    () =>
      [
        ...new Set(
          ledger.records
            .filter((item) => !item.isDeleted)
            .map((item) => item.description)
            .filter(Boolean),
        ),
      ].slice(-NOTE_SUGGESTION_LIMIT),
    [ledger.records],
  );
}
