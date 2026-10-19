import type { LedgerController } from "@hamster-ledger/ledger-react";
import { useEffect, useRef, type RefObject } from "react";
import { AppState } from "react-native";
const DEBOUNCE_MS = 1200;
const INTERVAL_MS = 15000;
export function useForegroundSync({
  sync,
  controller,
  enabled,
  conflict,
}: {
  sync: () => Promise<void>;
  controller: LedgerController;
  enabled: boolean;
  conflict: RefObject<boolean>;
}): void {
  const latest = useRef(sync);
  latest.current = sync;
  useEffect(() => {
    if (!enabled) return;
    const run = (): void => {
      if (!conflict.current && AppState.currentState === "active")
        void latest.current();
    };
    const interval = setInterval(run, INTERVAL_MS);
    const subscription = AppState.addEventListener("change", run);
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, conflict]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      if (!conflict.current && AppState.currentState === "active")
        void latest.current();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    enabled,
    conflict,
    controller.mode,
    controller.ledger,
    controller.books,
    controller.isSaving,
  ]);
}
