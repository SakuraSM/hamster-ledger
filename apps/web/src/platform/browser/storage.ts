import {
  createLedgerRepository,
  type KeyValueStore,
} from "@hamster-ledger/core";
const browserStore: KeyValueStore = {
  async getItem(key): Promise<string | null> {
    return localStorage.getItem(key);
  },
  async setItem(key, value): Promise<void> {
    localStorage.setItem(key, value);
  },
};
export const ledgerRepository = createLedgerRepository(browserStore);
