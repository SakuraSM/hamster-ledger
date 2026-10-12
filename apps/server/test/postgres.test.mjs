import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { testDatabase } from "./postgres-fixture.mjs";
import { setup, register, EMPTY } from "./helpers.mjs";
import { openDatabase as legacyDatabase } from "./legacy-schema.mjs";
import { importSqlite } from "../src/import-sqlite.mjs";
import { modelSecrets } from "../src/model-secrets.mjs";
import { applyOperation } from "../src/network-service.mjs";
import { book, account } from "./ai-fixtures.mjs";
import {
  saveAdvancedEntry,
  ledgerPatch,
  summarize,
} from "@hamster-ledger/core";
const original = {
  minor: 1250,
  currency: "CNY",
  rate: "1",
  date: "2026-10-03",
  source: "manual",
};
function expense(ledger, id) {
  return saveAdvancedEntry(ledger, {
    id,
    merchant: "PG QA",
    date: "2026-10-03 12:00:00",
    category: "餐饮",
    accountId: account.id,
    detail: { type: "expense", original, origin: "manual" },
  });
}
test("transactions roll back and return their connection after an error", async (context) => {
  const { database } = await testDatabase(context);
  await assert.rejects(
    database.transaction(async () => {
      await database
        .prepare("INSERT INTO auth_limits VALUES($1,1,1)")
        .run("rollback");
      throw new Error("synthetic rollback");
    }),
    /synthetic rollback/,
  );
  assert.equal(
    await database
      .prepare("SELECT * FROM auth_limits WHERE key=$1")
      .get("rollback"),
    undefined,
  );
  const values = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      database.transaction(async () => {
        await database
          .prepare("INSERT INTO auth_limits VALUES($1,1,1)")
          .run("parallel-" + index);
        return index;
      }),
    ),
  );
  assert.equal(values.length, 12);
  assert.equal(
    (await database.prepare("SELECT count(*) AS count FROM auth_limits").get())
      .count,
    12,
  );
});
test("separate PG connections enforce book revisions and durable replay identities", async (context) => {
  const client = await setup(context),
    cookie = await register(client),
    snapshot = await book(client, cookie),
    userId = client.sessions.get(cookie).user.id;
  const first = await client.openDatabase(),
    second = await client.openDatabase();
  const request = (database, id, key) =>
    applyOperation({
      database,
      bookId: snapshot.id,
      userId,
      now: Date.now,
      body: {
        key,
        revision: snapshot.revision,
        patch: ledgerPatch(snapshot.ledger, expense(snapshot.ledger, id)),
      },
    });
  const raced = await Promise.allSettled([
    request(first, "pg-a", "pg-race-a"),
    request(second, "pg-b", "pg-race-b"),
  ]);
  assert.equal(
    raced.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    raced.find((result) => result.status === "rejected").reason.status,
    409,
  );
  const winner = raced.findIndex((result) => result.status === "fulfilled");
  const retries = await Promise.all([
    request(
      first,
      winner ? "pg-b" : "pg-a",
      winner ? "pg-race-b" : "pg-race-a",
    ),
    request(
      second,
      winner ? "pg-b" : "pg-a",
      winner ? "pg-race-b" : "pg-race-a",
    ),
  ]);
  assert.equal(retries[0].operationId, retries[1].operationId);
  assert.equal(retries[0].ledger.records.length, 1);
});
async function sourceFixture(context) {
  const target = await testDatabase(context),
    path = join(target.dataDirectory, "source.sqlite"),
    source = legacyDatabase(path),
    user = "legacy-pg-user";
  const ledger = expense({ ...EMPTY, accounts: [account] }, "legacy-pg-record");
  source
    .prepare(
      "INSERT INTO users(id,username,password_hash,salt,password_version) VALUES(?,?,?,?,2)",
    )
    .run(user, "synthetic.pg", "opaque-password-hash", "opaque-salt");
  source
    .prepare("INSERT INTO books VALUES(?,?,?,?,?,?,?)")
    .run(
      "legacy-pg-book",
      user,
      "Synthetic PG",
      7,
      JSON.stringify(ledger),
      "2026-10-03T00:00:00.000Z",
      "server",
    );
  source
    .prepare("INSERT INTO book_members VALUES(?,?,?)")
    .run("legacy-pg-book", user, "owner");
  source
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at,id,created_at,last_seen_at,idle_seconds,remember,csrf_token,credential_version,device_name,transport) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      "opaque-session-hash",
      user,
      2000000000000,
      "session-qa",
      100,
      100,
      3600,
      0,
      "csrf-qa",
      1,
      "QA",
      "cookie",
    );
  source
    .prepare("INSERT INTO auth_limits VALUES(?,?,?)")
    .run("hashed-qa-limit", 2, 2000000000000);
  source
    .prepare("INSERT INTO book_invites VALUES(?,?,?,?,?,?,?,?)")
    .run(
      "invite-qa",
      "legacy-pg-book",
      "opaque-code-hash",
      "member",
      2000000000000,
      null,
      null,
      user,
    );
  source
    .prepare("INSERT INTO book_backups VALUES(?,?,?,?,?)")
    .run(
      "backup-qa",
      "legacy-pg-book",
      JSON.stringify(ledger),
      6,
      "2026-10-03T00:00:00.000Z",
    );
  source
    .prepare("INSERT INTO book_operations VALUES(?,?,?,?,?,?,?,?)")
    .run(
      "operation-qa",
      "legacy-pg-book",
      user,
      "app",
      "synthetic",
      7,
      JSON.stringify(ledger),
      "2026-10-03T00:00:00.000Z",
    );
  source
    .prepare("INSERT INTO book_requests VALUES(?,?,?,?,?)")
    .run(
      "legacy-pg-book",
      user,
      "request-qa",
      "digest-qa",
      JSON.stringify({ revision: 7, ledger }),
    );
  source
    .prepare("INSERT INTO open_tokens VALUES(?,?,?,?,?,?,?,?,?)")
    .run(
      "token-qa",
      "legacy-pg-book",
      user,
      "QA",
      "opaque-token-hash",
      '["records:read"]',
      2000000000000,
      null,
      "2026-10-03T00:00:00.000Z",
    );
  source
    .prepare("INSERT INTO open_rate_limits VALUES(?,?,?)")
    .run("token-qa", 100, 2);
  source
    .prepare("INSERT INTO open_requests VALUES(?,?,?,?,?,?)")
    .run("token-qa", "request-qa", "digest-qa", 200, '{"ok":true}', 100);
  source
    .prepare("INSERT INTO fx_rates VALUES(?,?,?,?)")
    .run("USD", "2026-10-03", "7.12", "manual");
  const bytes = Buffer.from("synthetic-attachment"),
    hash = createHash("sha256").update(bytes).digest("hex");
  source
    .prepare("INSERT INTO attachments VALUES(?,?,?,?,?,?,?,?)")
    .run(
      "attachment-qa",
      "legacy-pg-book",
      user,
      "image/png",
      "synthetic.png",
      hash,
      bytes,
      100,
    );
  source
    .prepare("INSERT INTO model_profiles VALUES(?,?,?)")
    .run(
      user,
      '{"endpoint":"https://synthetic.example/v1"}',
      modelSecrets(target.dataDirectory).seal(user, "synthetic-model-key"),
    );
  source
    .prepare("INSERT INTO book_options VALUES(?,?)")
    .run("legacy-pg-book", 1);
  source
    .prepare("INSERT INTO scheduler_runs VALUES(?,?)")
    .run("legacy-pg-book", "subscription:qa:2026-10-03");
  source.close();
  return { ...target, path, ledger, hash };
}
test("read-only SQLite import preserves every table, money, blobs, encrypted secrets and sequences", async (context) => {
  const fixture = await sourceFixture(context),
    before = await readFile(fixture.path);
  const options = {
    sourcePath: fixture.path,
    database: fixture.database,
    dataDirectory: fixture.dataDirectory,
  };
  const dry = await importSqlite(options);
  assert.equal(dry.tables.length, 17);
  assert.ok(dry.tables.every((table) => table.rows === 1));
  assert.equal(
    (
      await fixture.database
        .prepare("SELECT count(*) AS count FROM users")
        .get()
    ).count,
    0,
  );
  await importSqlite({ ...options, dryRun: false });
  assert.deepEqual(await readFile(fixture.path), before);
  const row = await fixture.database
    .prepare("SELECT ledger,revision FROM books")
    .get();
  assert.equal(row.revision, 7);
  assert.deepEqual(
    summarize(JSON.parse(row.ledger).records),
    summarize(fixture.ledger.records),
  );
  const image = await fixture.database
    .prepare("SELECT bytes,hash FROM attachments")
    .get();
  assert.equal(
    createHash("sha256").update(image.bytes).digest("hex"),
    fixture.hash,
  );
  const secret = await fixture.database
    .prepare("SELECT secret,user_id FROM model_profiles")
    .get();
  assert.equal(
    modelSecrets(fixture.dataDirectory).open(secret.user_id, secret.secret),
    "synthetic-model-key",
  );
  assert.equal(
    (
      await fixture.database
        .prepare("SELECT ai_auto_post FROM book_options")
        .get()
    ).ai_auto_post,
    true,
  );
  assert.equal(
    (
      await fixture.database
        .prepare(
          "SELECT nextval(pg_get_serial_sequence('book_operations','created_seq')) AS seq",
        )
        .get()
    ).seq,
    2,
  );
  await assert.rejects(importSqlite({ ...options, dryRun: false }), /非空/);
});
test("import failures roll back partially inserted rows and never repair the source", async (context) => {
  const fixture = await testDatabase(context),
    path = join(fixture.dataDirectory, "invalid.sqlite");
  const { DatabaseSync } = await import("node:sqlite"),
    source = new DatabaseSync(path);
  source.exec(
    "CREATE TABLE users(id TEXT,username TEXT,password_hash TEXT,salt TEXT)",
  );
  source
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run("one", "collision", "hash", "salt");
  source
    .prepare("INSERT INTO users VALUES(?,?,?,?)")
    .run("two", "collision", "hash", "salt");
  source.close();
  const before = await readFile(path);
  await assert.rejects(
    importSqlite({
      sourcePath: path,
      database: fixture.database,
      dryRun: false,
    }),
  );
  assert.equal(
    (
      await fixture.database
        .prepare("SELECT count(*) AS count FROM users")
        .get()
    ).count,
    0,
  );
  assert.deepEqual(await readFile(path), before);
});
