const MAX_BOOK_NAME_LENGTH = 40;
const DATE_KEY_LENGTH = 10;
const RECURRING_INTERVAL_MS = 60000;
import { useEffect, useRef, useState } from "react";
import {
  EMPTY_LEDGER,
  migrateLedger,
  DEFAULT_BOOKS,
  applyRecurring,
  type Book,
  resolveReview,
  type Ledger,
  type LedgerMode,
  type Review,
  type LedgerRepository,
} from "@hamster-ledger/core";
import { editLedgerRecord, type RecordEdit } from "./ledger-actions.js";

interface UndoEntry {
  ledger: Ledger;
  mode: LedgerMode;
}
interface WorkspaceState {
  books: Book[];
  ledgers: Record<LedgerMode, Ledger>;
  mode: LedgerMode;
}
export interface LedgerController {
  books: Book[];
  createBook: (name: string, initial?: Ledger) => Promise<LedgerMode>;
  updateBooks: (books: Book[]) => Promise<void>;
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
  notify: (message: string) => void;
}
export interface LedgerEnvironment {
  repository: LedgerRepository;
  createDemoLedger: () => Ledger;
  localNow: () => string;
  newEntityId: () => string;
}
export function useLedger({
  repository,
  createDemoLedger,
  localNow,
  newEntityId,
}: LedgerEnvironment): LedgerController {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => ({
    books: DEFAULT_BOOKS,
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
    Promise.all([repository.listBooks(), repository.loadActiveMode()])
      .then(async ([books, mode]) => {
        const entries = await Promise.all(
          books.map(async (book) => {
            const id = book.id as LedgerMode;
            return [
              id,
              (await repository.load(id)) ??
                (id === "demo" ? createDemoLedger() : EMPTY_LEDGER),
            ] as const;
          }),
        );
        if (isCancelled) return;
        setWorkspace({
          books,
          ledgers: Object.fromEntries(entries) as Record<LedgerMode, Ledger>,
          mode: books.some((book) => book.id === mode && !book.isArchived)
            ? mode
            : "personal",
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCancelled)
          setError(
            "无法读取本地账本。请检查本地存储或备份原始数据；当前已停止写入，避免覆盖。",
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
      setError("账本内容已保留，但本机未能记住当前账本选择。");
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
      const saved = migrateLedger(next);
      await repository.save(mode, saved);
      setUndoEntry({ ledger: previous, mode });
      setNotice("");
      setWorkspace((current) => ({
        ...current,
        ledgers: { ...current.ledgers, [mode]: saved },
        mode,
      }));
      setError("");
      await persistSelection(mode);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.includes("另一个页面")
          ? cause.message
          : "账本未能保存，请检查本地存储空间。",
      );
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
          ...current,
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
  async function updateBooks(books: Book[]): Promise<void> {
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后。");
    isWriteInProgress.current = true;
    setIsSaving(true);
    try {
      await repository.saveBooks(books);
      setWorkspace((current) => ({ ...current, books }));
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  async function createBook(
    name: string,
    initial: Ledger = EMPTY_LEDGER,
  ): Promise<LedgerMode> {
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后。");
    if (!name.trim() || name.trim().length > MAX_BOOK_NAME_LENGTH)
      throw new Error("账本名称需为 1–40 字。");
    isWriteInProgress.current = true;
    setIsSaving(true);
    try {
      const id: LedgerMode = `book:${newEntityId()}`;
      const books = [...workspace.books, { id, name: name.trim() }];
      await repository.save(id, initial);
      await repository.saveBooks(books);
      setWorkspace((current) => ({
        ...current,
        books,
        ledgers: { ...current.ledgers, [id]: initial },
        mode: id,
      }));
      await persistSelection(id);
      setUndoEntry(null);
      return id;
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  useEffect(() => {
    if (isLoading) return;
    let stopped = false;
    const run = async (): Promise<void> => {
      if (isWriteInProgress.current) return;
      const previous = workspace.ledgers[workspace.mode];
      try {
        const next = applyRecurring(
          previous,
          localNow().slice(0, DATE_KEY_LENGTH),
        );
        if (next !== previous && !stopped) await commit(next);
      } catch (cause) {
        if (!stopped)
          setError(cause instanceof Error ? cause.message : "周期记账失败");
      }
    };
    void run();
    const timer = setInterval(() => void run(), RECURRING_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [workspace, isLoading]);
  return {
    books: workspace.books,
    createBook,
    updateBooks,
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
    notify: setNotice,
  };
}
