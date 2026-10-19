import { useEffect } from "react";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { deliverPlanningNotifications } from "../platform/planning-notifications";
export function usePlanningNotifications(controller: LedgerController): void {
  useEffect(() => {
    if (!controller.ledger.preferences?.reminderEnabled) return;
    void deliverPlanningNotifications(
      controller.mode,
      controller.ledger.notifications ?? [],
    ).catch(() => {
      // Notices remain in the notification center if OS delivery fails.
    });
  }, [
    controller.mode,
    controller.ledger.notifications,
    controller.ledger.preferences?.reminderEnabled,
  ]);
}
