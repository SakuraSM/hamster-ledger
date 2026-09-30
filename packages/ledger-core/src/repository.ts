import { ledgerSchema, type Ledger, type LedgerMode } from "./model.js";

/** Platform adapter: localStorage, SQLite or another local store. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export interface LedgerRepository {
  load(mode: LedgerMode): Promise<Ledger | null>;
  save(mode: LedgerMode, ledger: Ledger): Promise<void>;
  loadActiveMode(): Promise<LedgerMode>;
  saveActiveMode(mode: LedgerMode): Promise<void>;
}
// Keep existing browser data readable when migrating from the initial prototype.
export const STORAGE_PREFIX = "hamster-ledger.v1.";
export function createLedgerRepository(store: KeyValueStore): LedgerRepository {
  return {
    async load(mode): Promise<Ledger | null> {
      const serialized = await store.getItem(STORAGE_PREFIX + mode);
      if (serialized === null) return null;
      return ledgerSchema.parse(JSON.parse(serialized));
    },
    async save(mode, ledger): Promise<void> {
      const validated = ledgerSchema.parse(ledger);
      await store.setItem(STORAGE_PREFIX + mode, JSON.stringify(validated));
    },
    async loadActiveMode(): Promise<LedgerMode> {
      return (await store.getItem(STORAGE_PREFIX + "active")) === "personal"
        ? "personal"
        : "demo";
    },
    async saveActiveMode(mode): Promise<void> {
      await store.setItem(STORAGE_PREFIX + "active", mode);
    },
  };
}
