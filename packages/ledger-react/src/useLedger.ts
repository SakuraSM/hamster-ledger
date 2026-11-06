const MAX_BOOK_NAME_LENGTH = 40;
const DATE_KEY_LENGTH = 10;
const RECURRING_INTERVAL_MS = 60000;
import { useEffect, useRef, useState } from "react";
import {
  EMPTY_LEDGER,
  migrateLedger,
  DEFAULT_BOOKS,
  applyPlanning,
  dueExchangeRequests,
  validateFinancialIntegrity,
  type Book,
  resolveReview,
  type Ledger,
  type LedgerMode,
  type Review,
} from "@hamster-ledger/core";
import { editLedgerRecord, type RecordEdit } from "./ledger-actions.js";
import { queueDirectoryWrite, queueLedgerWrite } from "./ledger-write-queue.js";
import { directoryFingerprint } from "./network-directory.js";
import {
  ledgerBindingKey,
  ledgerContextKey,
  type UndoEntry,
  type WorkspaceState,
} from "./ledger-state.js";
import type {
  CreateBookPreparation,
  LedgerController,
  LedgerEnvironment,
} from "./ledger-controller.js";
export type {
  CreateBookPreparation,
  LedgerController,
  LedgerEnvironment,
} from "./ledger-controller.js";

export function useLedger({
  repository,
  createDemoLedger,
  localNow,
  newEntityId,
  loadRates,
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
  const currentUndo = useRef(undoEntry);
  currentUndo.current = undoEntry;
  const isWriteInProgress = useRef(false);
  const latestWorkspace = useRef(workspace);
  latestWorkspace.current = workspace;
  const contextVersion = useRef({ key: ledgerContextKey(workspace), value: 0 });
  function setContext(next: WorkspaceState): void {
    const key = ledgerContextKey(next);
    if (key !== contextVersion.current.key) {
      contextVersion.current = { key, value: contextVersion.current.value + 1 };
    }
    latestWorkspace.current = next;
  }
  const capturedContextVersion = contextVersion.current.value;
  function ensureLocalWrite(mode: LedgerMode): void {
    const current = latestWorkspace.current;
    if (
      contextVersion.current.value !== capturedContextVersion ||
      ledgerBindingKey(workspace.books, mode) !==
        ledgerBindingKey(current.books, mode) ||
      current.books.find((book) => book.id === mode)?.cloud
    )
      throw new Error("账本或联网绑定已变化，请重新打开后重试。");
  }
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
        const next = {
          books,
          ledgers: Object.fromEntries(entries) as Record<LedgerMode, Ledger>,
          mode: books.some((book) => book.id === mode && !book.isArchived)
            ? mode
            : ("personal" as LedgerMode),
        };
        setContext(next);
        setWorkspace(next);
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
    setContext({ ...latestWorkspace.current, mode });
    setWorkspace((current) => ({ ...current, mode }));
    setUndoEntry(null);
    setNotice("");
    setError("");
    void persistSelection(mode);
  }
  async function commit(
    next: Ledger,
    modeOrOptions?: Parameters<LedgerController["commit"]>[1],
  ): Promise<void> {
    const assertCurrent =
      typeof modeOrOptions === "object"
        ? modeOrOptions?.assertCurrent
        : undefined;
    assertCurrent?.();
    const mode =
      typeof modeOrOptions === "string"
        ? modeOrOptions
        : (modeOrOptions?.mode ?? workspace.mode);
    if (
      typeof modeOrOptions !== "string" &&
      (modeOrOptions?.expectedRevision !== undefined ||
        modeOrOptions?.expectedCloud !== undefined)
    )
      throw new Error("本机账本无法验证联网版本，请重新打开账本。");
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后重试。");
    ensureLocalWrite(mode);
    isWriteInProgress.current = true;
    setIsSaving(true);
    const previous = workspace.ledgers[mode];
    let didWrite = false;
    try {
      const saved = migrateLedger(next);
      validateFinancialIntegrity(saved);
      await queueLedgerWrite({
        repository,
        mode,
        write: async () => {
          ensureLocalWrite(mode);
          assertCurrent?.();
          await repository.save(mode, saved);
          didWrite = true;
          assertCurrent?.();
        },
      });
      assertCurrent?.();
      setUndoEntry({ ledger: previous, mode });
      setNotice("");
      setContext({
        ...latestWorkspace.current,
        ledgers: { ...latestWorkspace.current.ledgers, [mode]: saved },
        mode,
      });
      setWorkspace((current) => ({
        ...current,
        ledgers: { ...current.ledgers, [mode]: saved },
        mode,
      }));
      setError("");
      await persistSelection(mode);
    } catch (cause) {
      setError(
        didWrite
          ? "账本身份已变化；本机数据可能已写入，请返回原账号核对。"
          : cause instanceof Error && cause.message.includes("另一个页面")
            ? cause.message
            : "账本未能保存，请检查本地存储空间。",
      );
      throw cause;
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  function decide(
    review: Review,
    decision: "linked" | "separate",
    options?: { assertCurrent?: () => void },
  ): void {
    try {
      options?.assertCurrent?.();
      const next = resolveReview({
        ledger: workspace.ledgers[workspace.mode],
        review,
        decision,
      });
      void commit(next, { assertCurrent: options?.assertCurrent })
        .then(() => {
          options?.assertCurrent?.();
          setNotice(
            decision === "linked"
              ? "已关联为一笔账单，原始流水已保留。"
              : "已保留为两笔独立账单。",
          );
        })
        .catch(() => {
          try {
            options?.assertCurrent?.();
          } catch {
            return;
          }
          setError("核对结果保存失败，请重试。");
        });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "核对失败");
    }
  }
  function undo(assertCurrent?: () => void): void {
    if (
      !undoEntry ||
      currentUndo.current !== undoEntry ||
      isWriteInProgress.current
    )
      return;
    try {
      assertCurrent?.();
      ensureLocalWrite(undoEntry.mode);
    } catch {
      return;
    }
    isWriteInProgress.current = true;
    setIsSaving(true);
    let didWrite = false;
    void queueLedgerWrite({
      repository,
      mode: undoEntry.mode,
      write: async () => {
        ensureLocalWrite(undoEntry.mode);
        if (currentUndo.current !== undoEntry)
          throw new Error("可撤销的操作已变化，请重新检查。");
        assertCurrent?.();
        await repository.save(undoEntry.mode, undoEntry.ledger);
        didWrite = true;
        assertCurrent?.();
      },
    })
      .then(async () => {
        assertCurrent?.();
        setContext({
          ...latestWorkspace.current,
          ledgers: {
            ...latestWorkspace.current.ledgers,
            [undoEntry.mode]: undoEntry.ledger,
          },
          mode: undoEntry.mode,
        });
        setWorkspace((current) => ({
          ...current,
          ledgers: { ...current.ledgers, [undoEntry.mode]: undoEntry.ledger },
          mode: undoEntry.mode,
        }));
        setUndoEntry(null);
        setNotice("已撤销上一次修改。");
        await persistSelection(undoEntry.mode);
      })
      .catch(() => {
        if (didWrite) {
          setError("账本身份已变化；本机数据可能已写入，请返回原账号核对。");
          return;
        }
        try {
          assertCurrent?.();
        } catch {
          return;
        }
        setError("撤销失败，账本未修改。");
      })
      .finally(() => {
        isWriteInProgress.current = false;
        setIsSaving(false);
      });
  }
  async function editRecord(
    input: RecordEdit,
    options?: { assertCurrent?: () => void },
  ): Promise<void> {
    options?.assertCurrent?.();
    await commit(
      editLedgerRecord(workspace.ledgers[workspace.mode], input),
      options,
    );
    options?.assertCurrent?.();
    setNotice(
      input.remember ? "已保存修改，并记住此商户的分类。" : "已保存账单修改。",
    );
  }
  async function updateBooks(
    books: Book[],
    options?: { expectedBooks?: Book[]; assertCurrent?: () => void },
  ): Promise<void> {
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后。");
    isWriteInProgress.current = true;
    setIsSaving(true);
    try {
      const expected = options?.expectedBooks ?? workspace.books;
      await queueDirectoryWrite({
        repository,
        write: async () => {
          options?.assertCurrent?.();
          const stored = await repository.listBooks();
          options?.assertCurrent?.();
          if (directoryFingerprint(stored) !== directoryFingerprint(expected))
            throw new Error("账本目录已变化，请重新打开后重试。");
          await repository.saveBooks(books);
        },
      });
      options?.assertCurrent?.();
      setContext({ ...latestWorkspace.current, books });
      setWorkspace((current) => ({ ...current, books }));
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  async function createBook(
    name: string,
    initial: Ledger = EMPTY_LEDGER,
    cloud?: Book["cloud"],
    prepare?: CreateBookPreparation,
  ): Promise<LedgerMode> {
    if (isLoading || isWriteInProgress.current)
      throw new Error("账本正在读写，请稍后。");
    if (!name.trim() || name.trim().length > MAX_BOOK_NAME_LENGTH)
      throw new Error("账本名称需为 1–40 字。");
    isWriteInProgress.current = true;
    setIsSaving(true);
    try {
      const id: LedgerMode = `book:${newEntityId()}`;
      const ensurePreparedCurrent = prepare?.assertCurrent;
      ensurePreparedCurrent?.();
      const storedBooks = await repository.listBooks();
      ensurePreparedCurrent?.();
      if (storedBooks.some((book) => book.id === id))
        throw new Error("账本 ID 已存在，请重新创建。");
      const storedById = new Map(storedBooks.map((book) => [book.id, book]));
      if (
        workspace.books.some((book) => {
          const stored = storedById.get(book.id);
          return (
            !stored ||
            directoryFingerprint([book]) !== directoryFingerprint([stored])
          );
        })
      )
        throw new Error("账本目录已变化，请重新打开后重试。");
      const missing = await Promise.all(
        storedBooks
          .filter((book) => !(book.id in latestWorkspace.current.ledgers))
          .map(
            async (book) =>
              [
                book.id,
                (await repository.load(book.id as LedgerMode)) ?? EMPTY_LEDGER,
              ] as const,
          ),
      );
      ensurePreparedCurrent?.();
      const books = [
        ...storedBooks,
        { id, name: name.trim(), ...(cloud ? { cloud } : {}) },
      ];
      await prepare?.(id);
      ensurePreparedCurrent?.();
      await queueLedgerWrite({
        repository,
        mode: id,
        write: async () => {
          ensurePreparedCurrent?.();
          await repository.save(id, initial);
        },
      });
      ensurePreparedCurrent?.();
      await queueDirectoryWrite({
        repository,
        write: async () => {
          ensurePreparedCurrent?.();
          const latestBooks = await repository.listBooks();
          ensurePreparedCurrent?.();
          if (
            directoryFingerprint(latestBooks) !==
            directoryFingerprint(storedBooks)
          )
            throw new Error("账本目录已变化，请重新打开后重试。");
          await repository.saveBooks(books);
        },
      });
      ensurePreparedCurrent?.();
      await persistSelection(id);
      ensurePreparedCurrent?.();
      setContext({
        ...latestWorkspace.current,
        books,
        ledgers: {
          ...latestWorkspace.current.ledgers,
          ...Object.fromEntries(missing),
          [id]: initial,
        },
        mode: id,
      });
      setWorkspace((current) => ({
        ...current,
        books,
        ledgers: {
          ...current.ledgers,
          ...Object.fromEntries(missing),
          [id]: initial,
        },
        mode: id,
      }));
      setUndoEntry(null);
      return id;
    } finally {
      isWriteInProgress.current = false;
      setIsSaving(false);
    }
  }
  useEffect(() => {
    if (
      isLoading ||
      workspace.books.find((book) => book.id === workspace.mode)?.cloud
    )
      return;
    let stopped = false;
    const run = async (): Promise<void> => {
      if (isWriteInProgress.current) return;
      const previous = workspace.ledgers[workspace.mode];
      try {
        const today = localNow().slice(0, DATE_KEY_LENGTH);
        const requests = dueExchangeRequests(previous, today);
        const rates =
          requests.length && loadRates ? await loadRates(requests) : [];
        if (stopped) return;
        const next = applyPlanning({ ledger: previous, today, rates });
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
    undo: () => undo(),
    undoWithGuard: (assertCurrent) => undo(assertCurrent),
    editRecord,
    dismissNotice: () => setNotice(""),
    notify: setNotice,
  };
}
