import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS books(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,revision INTEGER NOT NULL,ledger TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS books_user ON books(user_id);`);
  migrateAuth(database);
  return database;
}

function addColumn(database, table, name, declaration) {
  if (
    !database
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((column) => column.name === name)
  )
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${declaration}`);
}
function migrateAuth(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    addColumn(
      database,
      "users",
      "must_change_password",
      "INTEGER NOT NULL DEFAULT 0",
    );
    addColumn(
      database,
      "users",
      "password_version",
      "INTEGER NOT NULL DEFAULT 1",
    );
    addColumn(
      database,
      "users",
      "credential_version",
      "INTEGER NOT NULL DEFAULT 1",
    );
    for (const [name, type] of Object.entries({
      id: "TEXT",
      created_at: "INTEGER",
      last_seen_at: "INTEGER",
      idle_seconds: "INTEGER",
      remember: "INTEGER",
      csrf_token: "TEXT",
      credential_version: "INTEGER",
      device_name: "TEXT",
    }))
      addColumn(database, "sessions", name, type);
    database.exec(
      `DELETE FROM sessions WHERE id IS NULL OR csrf_token IS NULL; CREATE UNIQUE INDEX IF NOT EXISTS sessions_id ON sessions(id); CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id); CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,resets_at INTEGER NOT NULL);`,
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
