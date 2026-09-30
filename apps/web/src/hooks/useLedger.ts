import { useEffect, useRef, useState } from "react";
import {
  EMPTY_LEDGER,
  resolveReview,
  type Ledger,
  type LedgerMode,
  type Review,
  type LedgerRepository,
} from "@hamster-ledger/core";
import { createDemoLedger } from "../data/demo";
import { ledgerRepository } from "../platform/browser/storage";
import { editLedgerRecord, type RecordEdit } from "./ledger-actions";

interface UndoEntry {
  ledger: Ledger;
  mode: LedgerMode;
}
interface WorkspaceState {
  ledgers: Record<LedgerMode, Ledger>;
  mode: LedgerMode;
}
export interface LedgerController {
  ledger: Ledger;
  personalLedger: Ledger;
  mode: LedgerMode;
  notice: string;
  error: string;
  isLoading: boolean;
  isSaving: boolean;
  canUndo: boolean;
  switchMode: (mode: LedgerMode) => void;
  commit: (ledger: Ledger, mode?: LedgerMode) => Promise<void>;
  decide: (review: Review, decision: "linked" | "separate") => void;
  undo: () => void;
  editRecord: (input: RecordEdit) => Promise<void>;
  dismissNotice: () => void;
}
export function useLedger(
  repository: LedgerRepository = ledgerRepository,
): LedgerController {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => ({
    ledgers: { demo: createDemoLedger(), personal: EMPTY_LEDGER },
    mode: "demo",
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const isWriteInProgress = useRef(false);
  useEffect(() => {
    let isCancelled = false;
    Promise.all([
      repository.load("demo"),
      repository.load("personal"),
      repository.loadActiveMode(),
    ])
      .then(([demo, personal, mode]) => {
        if (isCancelled) return;
        setWorkspace({
          ledgers: {
            demo: demo ?? createDemoLedger(),
            personal: personal ?? EMPTY_LEDGER,
          },
          mode,
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCancelled)
          setError(
            "无法读取本地账本。请检查浏览器存储或备份原始数据；当前已停止写入，避免覆盖。",
          );
      });
    return () => {
      isCancelled = true;
    };
  }, [repository]);
  async function persistSelection(mode: LedgerMode): Promise<void> {
    try {
      await repository.saveActiveMode(mode);
    } catch {
      setError("账本内容已保留，但浏览器未能记住当前账本选择。");
    }
  }
  function switchMode(mode: LedgerMode): void {
    if (isLoading || isWriteInProgress.current) return;
    setWorkspace((current) => ({ ...current, mode }));
    setUndoEntry(null);
    setNotice("");
    setError("");
    void persistSelection(mode);
  }
  async function commit(
    next: Ledger,
    mode: LedgerMode = workspace.mode,
  ): Promise<void> {
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后重试。");
    isWriteInProgress.current = true;
    setIsSaving(true);
    const previous = workspace.ledgers[mode];
    try {
      await repository.save(mode, next);
      setUndoEntry({ ledger: previous, mode });
      setWorkspace((current) => ({
        ledgers: { ...current.ledgers, [mode]: next },
        mode,
      }));
      setError("");
      await persistSelection(mode);
    } catch (cause) {
      setError("账本未能保存，请检查浏览器存储空间。");
      throw cause;
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  function decide(review: Review, decision: "linked" | "separate"): void {
    try {
      const next = resolveReview({
        ledger: workspace.ledgers[workspace.mode],
        review,
        decision,
      });
      void commit(next)
        .then(() =>
          setNotice(
            decision === "linked"
              ? "已关联为一笔账单，原始流水已保留。"
              : "已保留为两笔独立账单。",
          ),
        )
        .catch(() => setError("核对结果保存失败，请重试。"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "核对失败");
    }
  }
  function undo(): void {
    if (!undoEntry || isWriteInProgress.current) return;
    isWriteInProgress.current = true;
    setIsSaving(true);
    void repository
      .save(undoEntry.mode, undoEntry.ledger)
      .then(async () => {
        setWorkspace((current) => ({
          ledgers: { ...current.ledgers, [undoEntry.mode]: undoEntry.ledger },
          mode: undoEntry.mode,
        }));
        setUndoEntry(null);
        setNotice("已撤销上一次修改。");
        await persistSelection(undoEntry.mode);
      })
      .catch(() => setError("撤销失败，账本未修改。"))
      .finally(() => {
        isWriteInProgress.current = false;
        setIsSaving(false);
      });
  }
  async function editRecord(input: RecordEdit): Promise<void> {
    await commit(editLedgerRecord(workspace.ledgers[workspace.mode], input));
    setNotice(
      input.remember ? "已保存修改，并记住此商户的分类。" : "已保存账单修改。",
    );
  }
  return {
    ledger: workspace.ledgers[workspace.mode],
    personalLedger: workspace.ledgers.personal,
    mode: workspace.mode,
    notice,
    error,
    isLoading,
    isSaving,
    canUndo: undoEntry !== null && !isSaving,
    switchMode,
    commit,
    decide,
    undo,
    editRecord,
    dismissNotice: () => setNotice(""),
  };
}
