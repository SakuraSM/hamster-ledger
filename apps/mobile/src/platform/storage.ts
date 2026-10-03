const HEX_RADIX = 16;
const HEX_BYTE_LENGTH = 2;
import * as SQLite from "expo-sqlite";
import * as SecureStore from "expo-secure-store";
import { getRandomBytesAsync } from "expo-crypto";
import { createLedgerRepository } from "@hamster-ledger/core";
import { createKeyedStore } from "./keyed-store";
const DATABASE_NAME = "hamster-ledger.db";
const KEY_NAME = "hamster-ledger-database-key-v1";
const KEY_BYTES = 32;
const DATABASE_VERSION = 1;
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    const bytes = await getRandomBytesAsync(KEY_BYTES);
    key = Array.from(bytes, (byte) =>
      byte.toString(HEX_RADIX).padStart(HEX_BYTE_LENGTH, "0"),
    ).join("");
    await SecureStore.setItemAsync(KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key))
    throw new Error("设备密钥损坏。账本未修改，请保留应用数据并联系支持。");
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await database.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await database.getFirstAsync<{ cipher_version: string }>(
      "PRAGMA cipher_version",
    );
    if (!cipher?.cipher_version)
      throw new Error("此安装包不支持加密数据库，请安装正式原生构建。");
    const version = await database.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    if ((version?.user_version ?? 0) > DATABASE_VERSION)
      throw new Error("账本来自更新版本，请升级应用后再打开。");
    await database.execAsync(
      "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
    );
    await database.withTransactionAsync(async () => {
      await database.execAsync(
        "CREATE TABLE IF NOT EXISTS ledger_values (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
      );
      await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    });
    return database;
  } catch (cause) {
    await database.closeAsync();
    throw cause;
  }
}
function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= openDatabase();
  return databasePromise;
}
export const nativeStore = createKeyedStore(getDatabase);
export const ledgerRepository = createLedgerRepository(nativeStore);
