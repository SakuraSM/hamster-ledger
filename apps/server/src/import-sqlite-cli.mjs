import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./database.mjs";
import { importSqlite } from "./import-sqlite.mjs";

async function main() {
  const args = process.argv.slice(2),
    position = args.indexOf("--source");
  if (
    position < 0 ||
    !args[position + 1] ||
    args.some(
      (arg, index) =>
        index !== position + 1 &&
        !["--source", "--apply", "--dry-run"].includes(arg),
    )
  )
    throw new Error(
      "用法：npm run db:import-sqlite -- --source 旧库路径 [--dry-run|--apply]",
    );
  const database = await openDatabase();
  try {
    console.log(
      JSON.stringify(
        await importSqlite({
          sourcePath: resolve(args[position + 1]),
          database,
          dataDirectory:
            process.env.LEDGER_DATA_DIR ?? dirname(resolve(args[position + 1])),
          dryRun: !args.includes("--apply"),
        }),
        null,
        2,
      ),
    );
  } finally {
    await database.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
