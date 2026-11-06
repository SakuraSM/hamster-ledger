import { bookSchema, DEFAULT_BOOKS, type Book } from "./planning-model.js";
import { ledgerSchema, type Ledger, type LedgerMode } from "./model.js";
import { validateAggregateAmounts } from "./money-bounds.js";
import { migrateLedger } from "./migration.js";
import { z } from "zod";

/** Platform adapter: localStorage, SQLite or another local store. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface NetworkCacheIdentity {
  mode: LedgerMode;
  id: string;
  userId: string;
  server: string;
}
export interface NetworkCacheEntry {
  status: "verified" | "revoked";
  revision?: number;
  ledger?: Ledger;
}
export interface LedgerRepository {
  listBooks(): Promise<Book[]>;
  saveBooks(books: Book[]): Promise<void>;
  load(mode: LedgerMode): Promise<Ledger | null>;
  save(mode: LedgerMode, ledger: Ledger): Promise<void>;
  loadActiveMode(): Promise<LedgerMode>;
  saveActiveMode(mode: LedgerMode): Promise<void>;
  loadNetworkCache?(
    identity: NetworkCacheIdentity,
  ): Promise<NetworkCacheEntry | null>;
  saveNetworkCache?(
    identity: NetworkCacheIdentity,
    entry: NetworkCacheEntry,
  ): Promise<void>;
}
// Keep existing browser data readable when migrating from the initial prototype.
export const STORAGE_PREFIX = "hamster-ledger.v1.";
const NETWORK_CACHE_PREFIX = STORAGE_PREFIX + "network-cache.v1.";
const cacheIdentitySchema = z.object({
  mode: z.string().min(1),
  id: z.string().min(1),
  userId: z.string().min(1),
  server: z.string().min(1),
});
const cacheEnvelopeSchema = z
  .object({
    version: z.literal(1),
    identity: cacheIdentitySchema,
    status: z.enum(["verified", "revoked"]),
    revision: z.number().int().nonnegative().optional(),
    ledger: ledgerSchema.optional(),
  })
  .superRefine((entry, context) => {
    if (
      entry.status === "verified" &&
      (entry.revision === undefined || !entry.ledger)
    )
      context.addIssue({ code: "custom", message: "联网缓存缺少已验证快照。" });
  });
function networkCacheKey(identity: NetworkCacheIdentity): string {
  return (
    NETWORK_CACHE_PREFIX +
    encodeURIComponent(
      JSON.stringify([
        identity.mode,
        identity.id,
        identity.userId,
        identity.server,
      ]),
    )
  );
}
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
      validateAggregateAmounts(validated);
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
    async loadNetworkCache(identity): Promise<NetworkCacheEntry | null> {
      const raw = await store.getItem(networkCacheKey(identity));
      if (!raw) return null;
      const entry = cacheEnvelopeSchema.parse(JSON.parse(raw));
      if (
        JSON.stringify(entry.identity) !==
        JSON.stringify(cacheIdentitySchema.parse(identity))
      )
        throw new Error("联网缓存身份不匹配。");
      return {
        status: entry.status,
        revision: entry.revision,
        ledger: entry.ledger ? migrateLedger(entry.ledger) : undefined,
      };
    },
    async saveNetworkCache(identity, entry): Promise<void> {
      const envelope = cacheEnvelopeSchema.parse({
        version: 1,
        identity,
        ...entry,
        ledger: entry.ledger ? migrateLedger(entry.ledger) : undefined,
      });
      if (envelope.ledger) validateAggregateAmounts(envelope.ledger);
      await store.setItem(networkCacheKey(identity), JSON.stringify(envelope));
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
