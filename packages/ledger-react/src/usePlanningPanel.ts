import { useRef, useState } from "react";
import type { Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "./useLedger.js";
import type { FinanceForm } from "./planning-forms/index.js";
export const PLANNING_TABS = {
  subscriptions: "订阅",
  debts: "借贷",
  goals: "储蓄目标",
  notifications: "通知中心",
} as const;
export type PlanningTab = keyof typeof PLANNING_TABS;
export interface PlanningPanelController {
  tab: PlanningTab;
  setTab: (value: PlanningTab) => void;
  form: FinanceForm | null;
  setForm: (value: FinanceForm | null) => void;
  error: string;
  isBusy: boolean;
  commit: (action: (ledger: Ledger) => Ledger) => Promise<void>;
}
export function usePlanningPanel(
  controller: LedgerController,
  initialTab: PlanningTab = "subscriptions",
): PlanningPanelController {
  const [tab, setTab] = useState<PlanningTab>(initialTab),
    [form, setForm] = useState<FinanceForm | null>(null),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const lock = useRef(false);
  return {
    tab,
    setTab,
    form,
    setForm,
    error,
    isBusy,
    async commit(action) {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await controller.commit(action(controller.ledger));
        controller.notify("计划已更新，可撤销本次修改。");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "保存失败。");
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
  };
}
