import { useMemo, useRef, useState } from "react";
import {
  pendingMatchCandidates,
  unpairedPendingRecords,
  resolvePendingRecord,
  type BillRecord,
} from "@hamster-ledger/core";
import type { LedgerController } from "./ledger-controller.js";

export interface PendingReviewController {
  records: BillRecord[];
  record?: BillRecord;
  candidates: BillRecord[];
  candidate?: BillRecord;
  selectRecord: (id: string) => void;
  selectCandidate: (id: string) => void;
  resolve: (decision: "link" | "confirm") => Promise<void>;
  isBusy: boolean;
  error: string;
}

export function usePendingReview(
  controller: LedgerController,
): PendingReviewController {
  const [selection, setSelection] = useState({ recordId: "", candidateId: "" });
  const [error, setError] = useState("");
  const [isBusy, setBusy] = useState(false);
  const lock = useRef(false);
  const records = useMemo(
    () => unpairedPendingRecords(controller.ledger),
    [controller.ledger],
  );
  const record =
    records.find((item) => item.id === selection.recordId) ?? records[0];
  const candidates = useMemo(
    () => (record ? pendingMatchCandidates(controller.ledger, record) : []),
    [controller.ledger, record],
  );
  const candidate =
    record?.id === selection.recordId
      ? candidates.find((item) => item.id === selection.candidateId)
      : undefined;
  async function resolve(decision: "link" | "confirm"): Promise<void> {
    if (lock.current || controller.isSaving || !record) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (decision === "link" && !candidate)
        throw new Error("请先选择要关联的流水。");
      const next = resolvePendingRecord(
        controller.ledger,
        decision === "link" && candidate
          ? { record, candidate, decision: "link" }
          : { record, decision: "confirm" },
      );
      await controller.commit(next);
      setSelection({ recordId: "", candidateId: "" });
      controller.notify(
        decision === "link"
          ? "已关联为一笔账单，原始流水已保留，可撤销。"
          : "已确认为独立账单，可撤销。",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "核对保存失败，请重试。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    records,
    record,
    candidates,
    candidate,
    resolve,
    error,
    isBusy: isBusy || controller.isSaving,
    selectRecord: (recordId) => {
      setSelection({ recordId, candidateId: "" });
      setError("");
    },
    selectCandidate: (candidateId) => {
      setSelection({ recordId: record?.id ?? "", candidateId });
      setError("");
    },
  };
}
