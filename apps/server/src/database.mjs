import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import pg from "pg";
export const SCHEMA_VERSION = 1;
const types = {
  getTypeParser(oid, format) {
    if ([114, 3802].includes(oid)) return (value) => value;
    if (oid === 1184) return (value) => new Date(value).toISOString();
    if (oid === 20)
      return (value) => {
        const number = Number(value);
        if (!Number.isSafeInteger(number))
          throw new Error("数据库整数超出安全范围。");
        return number;
      };
    return pg.types.getTypeParser(oid, format);
  },
};
export async function openDatabase({
  connectionString = process.env.DATABASE_URL,
  schema = "public",
  max = 10,
  requireSchema = true,
} = {}) {
  if (!connectionString)
    throw new Error("请配置 DATABASE_URL，服务端仅支持 PostgreSQL。");
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema))
    throw new Error("数据库 schema 名称无效。");
  const pool = new pg.Pool({
    connectionString,
    max,
    types,
    options: `-c timezone=UTC -c search_path=${schema} -c statement_timeout=15000 -c idle_in_transaction_session_timeout=20000`,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  const scope = new AsyncLocalStorage();
  pool.on("error", (error) =>
    console.error(
      "PostgreSQL idle connection failed",
      error.code ?? "connection_error",
    ),
  );
  let closing;
  const database = {
    schema,
    isInTransaction() {
      return Boolean(scope.getStore());
    },
    async query(sql, values = []) {
      return (scope.getStore() ?? pool).query(sql, values);
    },
    prepare(sql) {
      return {
        async get(...values) {
          return (await database.query(sql, values)).rows[0];
        },
        async all(...values) {
          return (await database.query(sql, values)).rows;
        },
        async run(...values) {
          return database.query(sql, values);
        },
      };
    },
    async transaction(action) {
      if (scope.getStore()) return action();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await scope.run(client, action);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async lockBook(bookId) {
      if (!scope.getStore()) throw new Error("账本写锁必须在事务中获取。");
      await database.query("SELECT id FROM books WHERE id=$1 FOR UPDATE", [
        bookId,
      ]);
    },
    async close() {
      closing ??= pool.end();
      await closing;
    },
  };
  try {
    await database.query("SELECT 1");
    if (requireSchema) {
      const version = await database
        .prepare("SELECT max(version) AS version FROM schema_migrations")
        .get();
      if (version?.version !== SCHEMA_VERSION)
        throw new Error("数据库版本不匹配，请执行 npm run db:migrate。");
    }
    return database;
  } catch (error) {
    await pool.end();
    if (error.code === "42P01")
      throw new Error("数据库尚未初始化，请执行 npm run db:migrate。");
    throw error;
  }
}
export async function migrateDatabase(database) {
  await database.transaction(async () => {
    await database.query(
      "SELECT pg_advisory_xact_lock(hashtext(current_schema()))",
    );
    await database.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const row = await database
      .prepare("SELECT max(version) AS version FROM schema_migrations")
      .get();
    if ((row.version ?? 0) > SCHEMA_VERSION)
      throw new Error("数据库来自更新版本。");
    if (!row.version) {
      await database.query(
        await readFile(
          new URL("../migrations/001-initial.sql", import.meta.url),
          "utf8",
        ),
      );
      await database
        .prepare("INSERT INTO schema_migrations(version) VALUES($1)")
        .run(SCHEMA_VERSION);
    }
  });
}
