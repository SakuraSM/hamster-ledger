import type { Book } from "@hamster-ledger/core";

export interface DirectoryIdentity {
  userId: string | null;
  server: string;
  isLoading: boolean;
}

export function canViewBook(book: Book, identity: DirectoryIdentity): boolean {
  return (
    !book.cloud ||
    Boolean(
      !identity.isLoading &&
      identity.userId &&
      book.cloud.userId === identity.userId &&
      book.cloud.server === identity.server,
    )
  );
}

export function directoryFingerprint(books: Book[]): string {
  return JSON.stringify(
    books.map((book) => [
      book.id,
      book.name,
      Boolean(book.isArchived),
      book.cloud?.id ?? null,
      book.cloud?.userId ?? null,
      book.cloud?.server ?? null,
      book.cloud?.role ?? null,
    ]),
  );
}

export function mergeVisibleBooks(input: {
  current: Book[];
  proposed: Book[];
  identity: DirectoryIdentity;
}): Book[] {
  const hiddenIds = new Set(
    input.current
      .filter((book) => !canViewBook(book, input.identity))
      .map((book) => book.id),
  );
  const replacements = new Map<string, Book>();
  const existingById = new Map(input.current.map((book) => [book.id, book]));
  for (const book of input.proposed) {
    if (
      hiddenIds.has(book.id) ||
      replacements.has(book.id) ||
      !canViewBook(book, input.identity)
    )
      throw new Error("账本 ID 冲突或联网身份不匹配，请重新检查。");
    const existing = existingById.get(book.id)?.cloud;
    if (
      existing &&
      (!book.cloud ||
        book.cloud.id !== existing.id ||
        book.cloud.userId !== existing.userId ||
        book.cloud.server !== existing.server)
    )
      throw new Error("联网账本绑定已变化，请重新检查。");
    replacements.set(book.id, book);
  }
  const merged: Book[] = [];
  for (const book of input.current) {
    if (hiddenIds.has(book.id)) merged.push(book);
    else {
      const replacement = replacements.get(book.id);
      if (replacement) merged.push(replacement);
      replacements.delete(book.id);
    }
  }
  return [...merged, ...replacements.values()];
}
