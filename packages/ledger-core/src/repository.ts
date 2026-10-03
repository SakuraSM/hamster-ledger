import { bookSchema, DEFAULT_BOOKS, type Book } from "./planning-model.js";
import { ledgerSchema, type Ledger, type LedgerMode } from "./model.js";
import { migrateLedger } from "./migration.js";

/** Platform adapter: localStorage, SQLite or another local store. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface LedgerRepository {
  listBooks(): Promise<Book[]>;
  saveBooks(books: Book[]): Promise<void>;
  load(mode: LedgerMode): Promise<Ledger | null>;
  save(mode: LedgerMode, ledger: Ledger): Promise<void>;
  loadActiveMode(): Promise<LedgerMode>;
  saveActiveMode(mode: LedgerMode): Promise<void>;
}
// Keep existing browser data readable when migrating from the initial prototype.
export const STORAGE_PREFIX = "hamster-ledger.v1.";
function validateBooks(input: unknown): Book[] {
  const books = bookSchema.array().parse(input);
  if (
    !DEFAULT_BOOKS.every((required) =>
      books.some((book) => book.id === required.id && !book.isArchived),
    )
  )
    throw new Error("默认账本不能移除或归档。");
  if (new Set(books.map((book) => book.id)).size !== books.length)
    throw new Error("账本 ID 重复。");
  return books;
}
export function createLedgerRepository(store: KeyValueStore): LedgerRepository {
  const loadedRaw = new Map<LedgerMode, string>();
  return {
    async listBooks(): Promise<Book[]> {
      const raw = await store.getItem(STORAGE_PREFIX + "books");
      return raw ? validateBooks(JSON.parse(raw)) : DEFAULT_BOOKS;
    },
    async saveBooks(books): Promise<void> {
      const valid = validateBooks(books);
      await store.setItem(STORAGE_PREFIX + "books", JSON.stringify(valid));
    },
    async load(mode): Promise<Ledger | null> {
      const serialized = await store.getItem(STORAGE_PREFIX + mode);
      if (serialized === null) return null;
      const ledger = migrateLedger(JSON.parse(serialized));
      loadedRaw.set(mode, serialized);
      return ledger;
    },
    async save(mode, ledger): Promise<void> {
      const validated = migrateLedger(ledger);
      const previous = loadedRaw.get(mode);
      if (previous && ledgerSchema.parse(JSON.parse(previous)).version === 1) {
        const backupKey = STORAGE_PREFIX + "migration-v1." + mode;
        if ((await store.getItem(backupKey)) === null)
          await store.setItem(backupKey, previous);
      }
      const serialized = JSON.stringify(validated);
      await store.setItem(STORAGE_PREFIX + mode, serialized);
      loadedRaw.set(mode, serialized);
    },
    async loadActiveMode(): Promise<LedgerMode> {
      const mode = await store.getItem(STORAGE_PREFIX + "active");
      return mode === "personal" || mode?.startsWith("book:")
        ? (mode as LedgerMode)
        : "demo";
    },
    async saveActiveMode(mode): Promise<void> {
      await store.setItem(STORAGE_PREFIX + "active", mode);
    },
  };
}
