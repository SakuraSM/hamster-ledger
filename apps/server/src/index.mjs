import { resolve } from "node:path";
import { createLedgerServer } from "./server.mjs";
const root = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.PORT ?? 4180);
const host = process.env.HOST ?? "127.0.0.1";
async function main() {
  const server = await createLedgerServer({
    databaseUrl: process.env.DATABASE_URL,
    dataDirectory: process.env.LEDGER_DATA_DIR ?? resolve(root, "data"),
    webRoot: process.env.WEB_ROOT ?? resolve(root, "apps/web/dist/client"),
    publicOrigin: process.env.PUBLIC_ORIGIN,
    timeZone: process.env.LEDGER_TIMEZONE ?? "Asia/Shanghai",
    allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  });
  server.listen(port, host, () =>
    console.log(`Hamster Ledger listening on http://${host}:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.close(() => process.exit(0)));
}
main().catch((error) => {
  console.error(
    "服务启动失败，请检查数据库与部署配置。",
    error.code ?? "startup_error",
  );
  process.exitCode = 1;
});
