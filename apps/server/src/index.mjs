import { resolve } from "node:path";
import { createLedgerServer } from "./server.mjs";
const root = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.PORT ?? 4180);
const host = process.env.HOST ?? "127.0.0.1";
const server = createLedgerServer({
  databasePath:
    process.env.DATABASE_PATH ?? resolve(root, "data/ledger.sqlite"),
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
