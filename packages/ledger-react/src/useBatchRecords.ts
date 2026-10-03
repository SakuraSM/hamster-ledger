import { useRef, useState } from "react";
import { batchRecords, type BillRecord } from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";
export interface BatchController {
  selected: string[];
  error: string;
  isBusy: boolean;
  toggle: (record: BillRecord) => void;
  select: (records: BillRecord[]) => void;
  clear: () => void;
  apply: (action: "category" | "delete", category?: string) => Promise<void>;
}
export function useBatchRecords(controller: LedgerController): BatchController {
  const [records, setRecords] = useState<BillRecord[]>([]),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const lock = useRef(false);
  function toggle(record: BillRecord): void {
    setRecords((previous) =>
      previous.some((item) => item.id === record.id)
        ? previous.filter((item) => item.id !== record.id)
        : [...previous, record],
    );
  }
  async function apply(
    action: "category" | "delete",
    category?: string,
  ): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = batchRecords(controller.ledger, {
        records,
        action,
        category,
      });
      await controller.commit(next);
      controller.notify(
        `已${action === "delete" ? "删除" : "修改分类"} ${records.length} 笔，可撤销。`,
      );
      setRecords([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "批量操作失败，所选账单已保留。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    selected: records.map((item) => item.id),
    error,
    isBusy,
    toggle,
    select: setRecords,
    clear: () => setRecords([]),
    apply,
  };
}
