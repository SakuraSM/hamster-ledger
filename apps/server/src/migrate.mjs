import { openDatabase, migrateDatabase } from "./database.mjs";
async function main() {
  const database = await openDatabase({ requireSchema: false });
  try {
    await migrateDatabase(database);
    console.log("PostgreSQL schema 已就绪。");
  } finally {
    await database.close();
  }
}
main().catch((error) => {
  console.error("数据库迁移失败。", error.code ?? error.message);
  process.exitCode = 1;
});
