import type { Book, Ledger, LedgerMode } from "@hamster-ledger/core";

export interface UndoEntry {
  ledger: Ledger;
  mode: LedgerMode;
}
export interface WorkspaceState {
  books: Book[];
  ledgers: Record<LedgerMode, Ledger>;
  mode: LedgerMode;
}

export function ledgerBindingKey(books: Book[], mode: LedgerMode): string {
  const cloud = books.find((book) => book.id === mode)?.cloud;
  return JSON.stringify([
    cloud?.id ?? null,
    cloud?.userId ?? null,
    cloud?.server ?? null,
  ]);
}
export function ledgerContextKey(workspace: WorkspaceState): string {
  return JSON.stringify([
    workspace.mode,
    ledgerBindingKey(workspace.books, workspace.mode),
  ]);
}
