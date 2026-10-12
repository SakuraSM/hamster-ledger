import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
export function createLegacyAuthFixture({ path, hash, salt, token, ledger }) {
  const database = new DatabaseSync(path);
  database.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,salt TEXT);CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);CREATE TABLE books(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,revision INTEGER,ledger TEXT,updated_at TEXT);",
  );
  database
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run("legacy", "legacy.user", hash.toString("hex"), salt);
  database
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(
      createHash("sha256").update(token).digest("hex"),
      "legacy",
      Date.now() + 86400000,
    );
  database
    .prepare("INSERT INTO books VALUES(?,?,?,?,?,?)")
    .run(
      "legacy-book",
      "legacy",
      "旧账本",
      7,
      JSON.stringify(ledger),
      "2026-10-02",
    );
  database.close();
}
