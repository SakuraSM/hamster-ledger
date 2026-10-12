import { test } from "node:test";
import assert from "node:assert/strict";
import { createLegacyAuthFixture } from "./legacy-fixtures.mjs";
import { scrypt, createHash } from "node:crypto";
import { promisify } from "node:util";
import { setup, register, login, EMPTY, TEST_PASSWORD } from "./helpers.mjs";
import { AUTH_POLICY } from "../src/auth-policy.mjs";
import { resetAccountPassword } from "../src/reset-password.mjs";
test("preserves legacy users and books while upgrading hashes and invalidating legacy sessions", async (context) => {
  const password = "legacy-pass1";
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = await promisify(scrypt)(password, salt, 64);
  const token = "l".repeat(43);
  const client = await setup(context, {
    initialize: (path) =>
      createLegacyAuthFixture({ path, hash, salt, token, ledger: EMPTY }),
  });
  assert.equal(
    (await client.request("/api/books", { cookie: "hamster_session=" + token }))
      .status,
    401,
  );
  const cookie = await login(client, "legacy.user", { password });
  const books = await (await client.request("/api/books", { cookie })).json();
  assert.equal(books.books[0].revision, 7);
  const database = await client.openDatabase();
  assert.equal(
    (
      await database
        .prepare("SELECT password_version FROM users WHERE id=$1")
        .get("legacy")
    ).password_version,
    2,
  );
  await database.close();
});
test("administrator reset forces a password change before cloud access", async (context) => {
  const client = await setup(context);
  const original = await register(client);
  const database = await client.openDatabase();
  const reset = await resetAccountPassword({ database, username: "test.user" });
  await database.close();
  assert.equal(
    (await client.request("/api/books", { cookie: original })).status,
    401,
  );
  const temporary = await login(client, "test.user", {
    password: reset.temporaryPassword,
  });
  assert.equal(client.sessions.get(temporary).user.mustChangePassword, true);
  const forbidden = await client.request("/api/books", { cookie: temporary });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).code, "password_change_required");
  const update = await client.request("/api/auth/password", {
    method: "POST",
    cookie: temporary,
    body: {
      currentPassword: reset.temporaryPassword,
      newPassword: "new-owner-password-123",
    },
  });
  assert.equal(update.status, 200);
  const fresh = update.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await client.request("/api/books", { cookie: fresh })).status,
    200,
  );
});
test("reports closed registration and rejects oversized auth bodies", async (context) => {
  const closed = await setup(context, { allowRegistration: false });
  assert.equal(
    (await (await closed.request("/api/auth/me")).json()).policy
      .allowRegistration,
    false,
  );
  assert.equal(
    (
      await closed.request("/api/auth/register", {
        method: "POST",
        body: { username: "closed.user", password: TEST_PASSWORD },
      })
    ).status,
    403,
  );
  const client = await setup(context);
  assert.equal(
    (
      await client.request("/api/auth/login", {
        method: "POST",
        body: { username: "long.user", password: "x".repeat(10000) },
      })
    ).status,
    413,
  );
});
