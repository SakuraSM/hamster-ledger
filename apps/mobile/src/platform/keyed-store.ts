import type { KeyValueStore } from "@hamster-ledger/core";
export interface TransactionalStore extends KeyValueStore {
  setItems: (values: Record<string, string | null>) => Promise<void>;
}
export interface KeyedDatabase {
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
  withTransactionAsync(action: () => Promise<void>): Promise<void>;
}
// SQLCipher keys belong to a connection. Keep every operation on the original
// keyed connection and serialize reads with transactions to prevent partial reads.
export function createKeyedStore(
  getDatabase: () => Promise<KeyedDatabase>,
): TransactionalStore {
  let pending: Promise<void> = Promise.resolve();
  function run<Result>(
    operation: (database: KeyedDatabase) => Promise<Result>,
  ): Promise<Result> {
    const result = pending.then(async () => operation(await getDatabase()));
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  function setItems(values: Record<string, string | null>): Promise<void> {
    return run((database) =>
      database.withTransactionAsync(async () => {
        for (const [key, value] of Object.entries(values)) {
          if (value === null)
            await database.runAsync(
              "DELETE FROM ledger_values WHERE key = ?",
              key,
            );
          else
            await database.runAsync(
              "INSERT INTO ledger_values(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
              key,
              value,
            );
        }
      }),
    );
  }
  return {
    setItems,
    getItem(key) {
      return run(async (database) => {
        const row = await database.getFirstAsync<{ value: string }>(
          "SELECT value FROM ledger_values WHERE key = ?",
          key,
        );
        return row?.value ?? null;
      });
    },
    setItem(key, value) {
      return setItems({ [key]: value });
    },
  };
}
