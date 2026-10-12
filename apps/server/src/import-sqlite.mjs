import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  migrateLedger,
  validateFinancialIntegrity,
  summarize,
} from "@hamster-ledger/core";
import { modelSecrets } from "./model-secrets.mjs";
export const IMPORT_TABLES = [
  "users",
  "sessions",
  "books",
  "auth_limits",
  "book_members",
  "book_invites",
  "book_backups",
  "book_operations",
  "book_requests",
  "open_tokens",
  "open_rate_limits",
  "open_requests",
  "fx_rates",
  "attachments",
  "model_profiles",
  "book_options",
  "scheduler_runs",
];
const BOOLEAN_COLUMNS = new Set([
  "must_change_password",
  "remember",
  "ai_auto_post",
]);
import { checksum } from "./sqlite-verification.mjs";

export async function importSqlite({
  sourcePath,
  database,
  dataDirectory = dirname(sourcePath),
  dryRun = true,
}) {
  if (!existsSync(sourcePath)) throw new Error("旧 SQLite 文件不存在。");
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    source.exec("BEGIN");
    const present = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((row) => row.name),
    );
    for (const table of present)
      if (
        !IMPORT_TABLES.includes(table) &&
        !table.startsWith("sqlite_") &&
        source
          .prepare(
            `SELECT count(*) AS count FROM "${table.replaceAll('"', '""')}"`,
          )
          .get().count
      )
        throw new Error("旧库包含未知业务表，请升级迁移工具。");
    const report = { dryRun, tables: [], ledgerChecks: [] };
    const batches = [];
    for (const table of IMPORT_TABLES) {
      const columns = (
        await database.query(
          "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
          [database.schema, table],
        )
      ).rows;
      const allowed = new Set(columns.map((column) => column.column_name));
      const jsonColumns = new Set(
        columns
          .filter((column) => column.data_type === "jsonb")
          .map((column) => column.column_name),
      );
      const timestampColumns = new Set(
        columns
          .filter((column) => column.data_type === "timestamp with time zone")
          .map((column) => column.column_name),
      );
      if (
        present.has(table) &&
        source
          .prepare(`PRAGMA table_info("${table}")`)
          .all()
          .some((column) => !allowed.has(column.name))
      )
        throw new Error(`旧库表 ${table} 含未知字段，请升级迁移工具。`);
      const rows = present.has(table)
        ? source
            .prepare(
              `SELECT rowid AS legacy_rowid,* FROM "${table}" ORDER BY rowid`,
            )
            .all()
        : [];
      const normalized = rows
        .filter((row) => table !== "sessions" || (row.id && row.csrf_token))
        .map((row) =>
          Object.fromEntries(
            Object.entries({
              ...row,
              ...(["sessions", "book_operations"].includes(table)
                ? { created_seq: row.legacy_rowid }
                : {}),
            })
              .filter(([key]) => allowed.has(key))
              .map(([key, value]) => [
                key,
                BOOLEAN_COLUMNS.has(key) ? Boolean(value) : value,
              ]),
          ),
        );
      if (table === "books" || table === "book_backups")
        for (const row of normalized) {
          const ledger = migrateLedger(JSON.parse(row.ledger));
          validateFinancialIntegrity(ledger);
          report.ledgerChecks.push({
            table,
            id: row.id,
            revision: row.revision,
            records: ledger.records.length,
            totalsMinor: summarize(ledger.records),
          });
        }
      if (table === "model_profiles" && normalized.some((row) => row.secret)) {
        if (
          !process.env.LEDGER_MODEL_MASTER_KEY &&
          !existsSync(resolve(dataDirectory, ".model-key"))
        )
          throw new Error("缺少原模型主密钥，迁移已停止。");
        const secrets = modelSecrets(dataDirectory);
        for (const row of normalized)
          if (row.secret) secrets.open(row.user_id, row.secret);
      }
      if (
        (
          await database
            .prepare(`SELECT count(*) AS count FROM "${table}"`)
            .get()
        ).count
      )
        throw new Error(`目标业务表 ${table} 非空，拒绝覆盖。`);
      batches.push({ table, rows: normalized, jsonColumns, timestampColumns });
      report.tables.push({
        table,
        rows: normalized.length,
        checksum: checksum({ rows: normalized, jsonColumns, timestampColumns }),
        skipped: rows.length - normalized.length,
      });
    }
    if (dryRun) return report;
    await database.transaction(async () => {
      await database.query(
        "SELECT pg_advisory_xact_lock(hashtext(current_schema()))",
      );
      for (const { table } of batches) {
        await database.query(`LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`);
        if (
          (
            await database
              .prepare(`SELECT count(*) AS count FROM "${table}"`)
              .get()
          ).count
        )
          throw new Error("目标数据库已有写入，迁移已停止。");
      }
      for (const batch of batches) {
        for (const row of batch.rows) {
          const columns = Object.keys(row);
          await database.query(
            `INSERT INTO "${batch.table}" (${columns.map((key) => '"' + key + '"').join(",")}) VALUES(${columns.map((_, index) => "$" + (index + 1)).join(",")})`,
            Object.values(row),
          );
        }
        if (["sessions", "book_operations"].includes(batch.table))
          await database.query(
            `SELECT setval(pg_get_serial_sequence('${batch.table}','created_seq'),COALESCE(MAX(created_seq),1),MAX(created_seq) IS NOT NULL) FROM "${batch.table}"`,
          );
        const actual = (
          await database.query(
            `SELECT * FROM "${batch.table}" ORDER BY ${["sessions", "book_operations"].includes(batch.table) ? "created_seq" : "1"}`,
          )
        ).rows;
        if (actual.length !== batch.rows.length)
          throw new Error(`表 ${batch.table} 数量核对失败。`);
        const keys = Object.keys(batch.rows[0] ?? {});
        const checksumRow = (row) =>
          checksum({
            rows: [row],
            jsonColumns: batch.jsonColumns,
            timestampColumns: batch.timestampColumns,
          });
        const hashes = new Set(
          actual.map((row) =>
            checksumRow(Object.fromEntries(keys.map((key) => [key, row[key]]))),
          ),
        );
        if (batch.rows.some((row) => !hashes.has(checksumRow(row))))
          throw new Error(`表 ${batch.table} 内容核对失败。`);
      }
    });
    return report;
  } finally {
    source.close();
  }
}
