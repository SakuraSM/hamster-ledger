import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { testDatabase } from "./postgres-fixture.mjs";
import { importSqlite } from "../src/import-sqlite.mjs";
import { createLedgerServer } from "../src/server.mjs";
export const EMPTY = {
  version: 1,
  records: [],
  reviews: [],
  rules: {},
  files: [],
  accounts: [],
};
export const TEST_PASSWORD = "synthetic-test-password-123";
export async function setup(context, { initialize, ...options } = {}) {
  const fixture = await testDatabase(context);
  const databasePath = join(fixture.dataDirectory, "legacy.sqlite");
  if (initialize) {
    await initialize(databasePath);
    await importSqlite({
      sourcePath: databasePath,
      database: fixture.database,
      dryRun: false,
    });
  }
  const server = await createLedgerServer({
    enableScheduler: false,
    databaseUrl: fixture.databaseUrl,
    databaseSchema: fixture.schema,
    dataDirectory: fixture.dataDirectory,
    webRoot: resolve(import.meta.dirname, "../../web/dist/client"),
    ...options,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  fixture.cleanupTasks.push(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  const sessions = new Map();
  return {
    server,
    origin,
    ...fixture,
    databasePath,
    sessions,
    request: async (
      path,
      {
        method = "GET",
        body,
        cookie,
        originOverride = options.publicOrigin ?? origin,
        autoCsrf = true,
        headers = {},
      } = {},
    ) => {
      const auth = cookie ? sessions.get(cookie) : null;
      const response = await fetch(origin + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Hamster-Client": "1",
          Origin: originOverride,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(auth ? { "X-Hamster-User": auth.user.id } : {}),
          ...(auth && autoCsrf ? { "X-CSRF-Token": auth.csrfToken } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie && response.ok) {
        const receipt = await response.clone().json();
        if (receipt.user) sessions.set(setCookie.split(";")[0], receipt);
      }
      return response;
    },
  };
}
export async function register(client, username = "test.user", options = {}) {
  const response = await client.request("/api/auth/register", {
    method: "POST",
    body: { username, password: TEST_PASSWORD, ...options },
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  return response.headers.get("set-cookie").split(";")[0];
}
export async function login(client, username = "test.user", options = {}) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: { username, password: TEST_PASSWORD, ...options },
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
