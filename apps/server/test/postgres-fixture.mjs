import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, migrateDatabase } from "../src/database.mjs";
export async function testDatabase(context) {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "服务端测试需要 TEST_DATABASE_URL；可运行 npm run test:server 自动启动隔离 PG。",
    );
  const schema = "qa_" + randomUUID().replaceAll("-", "");
  const directory = await mkdtemp(join(tmpdir(), "hamster-pg-"));
  const admin = await openDatabase({
    connectionString,
    requireSchema: false,
    max: 1,
  });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const clients = [],
    cleanupTasks = [];
  async function connect() {
    const db = await openDatabase({
      connectionString,
      schema,
      requireSchema: false,
      max: 2,
    });
    clients.push(db);
    return db;
  }
  const database = await connect();
  await migrateDatabase(database);
  context.after(async () => {
    try {
      for (const cleanup of cleanupTasks) await cleanup();
      for (const db of clients) await db.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    } finally {
      await admin.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
  return {
    database,
    dataDirectory: directory,
    schema,
    databaseUrl: connectionString,
    openDatabase: connect,
    cleanupTasks,
  };
}
