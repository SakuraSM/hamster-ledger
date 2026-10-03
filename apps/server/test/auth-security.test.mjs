import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { scrypt, createHash } from "node:crypto";
import { promisify } from "node:util";
import { setup, register, login, EMPTY, TEST_PASSWORD } from "./helpers.mjs";
import { AUTH_POLICY } from "../src/auth-policy.mjs";
import { resetAccountPassword } from "../src/reset-password.mjs";

test("requires both a session CSRF token and the expected account for writes", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const body = { name: "安全测试", ledger: EMPTY };
  const missing = await client.request("/api/books", {
    method: "POST",
    body,
    cookie,
    autoCsrf: false,
  });
  assert.equal(missing.status, 403);
  assert.equal((await missing.json()).code, "csrf_invalid");
  assert.equal(
    (
      await client.request("/api/books", {
        method: "POST",
        body,
        cookie,
        headers: { "X-CSRF-Token": "wrong" },
      })
    ).status,
    403,
  );
  const changed = await client.request("/api/books", {
    method: "POST",
    body,
    cookie,
    headers: { "X-Hamster-User": "another-user" },
  });
  assert.equal(changed.status, 401);
  assert.equal((await changed.json()).code, "account_changed");
  assert.equal(
    (await client.request("/api/books", { method: "POST", body, cookie }))
      .status,
    201,
  );
});
test("uses transient cookies by default, persistent cookies only on request, and host-prefixed secure cookies for HTTPS", async (context) => {
  const client = await setup(context);
  const first = await client.request("/api/auth/register", {
    method: "POST",
    body: { username: "cookie.user", password: TEST_PASSWORD },
  });
  assert.doesNotMatch(first.headers.get("set-cookie"), /Max-Age/);
  const remembered = await client.request("/api/auth/login", {
    method: "POST",
    body: { username: "cookie.user", password: TEST_PASSWORD, remember: true },
  });
  assert.match(remembered.headers.get("set-cookie"), /Max-Age=2592000/);
  const secure = await setup(context, {
    publicOrigin: "https://ledger.example.test",
  });
  const response = await secure.request("/api/auth/register", {
    method: "POST",
    body: { username: "secure.user", password: TEST_PASSWORD },
  });
  assert.match(response.headers.get("set-cookie"), /^__Host-hamster_session=/);
  assert.match(response.headers.get("set-cookie"), /; Secure/);
  assert.match(response.headers.get("strict-transport-security"), /31536000/);
});
test("expires idle sessions despite background reads and applies an absolute deadline", async (context) => {
  let now = Date.now();
  const client = await setup(context, { now: () => now });
  const cookie = await register(client);
  now += 20 * 60 * 1000;
  assert.equal((await client.request("/api/books", { cookie })).status, 200);
  now += 11 * 60 * 1000;
  assert.equal((await client.request("/api/books", { cookie })).status, 401);
  const remembered = await login(client, "test.user", { remember: true });
  for (let step = 0; step < 5; step++) {
    now += 6 * 24 * 60 * 60 * 1000;
    if (step < 4)
      assert.equal(
        (
          await client.request("/api/auth/activity", {
            method: "POST",
            body: {},
            cookie: remembered,
          })
        ).status,
        200,
      );
  }
  assert.equal(
    (await client.request("/api/books", { cookie: remembered })).status,
    401,
  );
});
test("returns the same login error for missing accounts and wrong passwords and enforces persistent account throttling", async (context) => {
  const client = await setup(context);
  await register(client);
  const wrong = await client.request("/api/auth/login", {
    method: "POST",
    body: { username: "test.user", password: "incorrect-password-value" },
  });
  const unknown = await client.request("/api/auth/login", {
    method: "POST",
    body: { username: "not.registered", password: "incorrect-password-value" },
  });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
  for (let attempt = 1; attempt < AUTH_POLICY.accountAttempts; attempt++)
    assert.equal(
      (
        await client.request("/api/auth/login", {
          method: "POST",
          body: { username: "test.user", password: "incorrect-password-value" },
        })
      ).status,
      401,
    );
  const blocked = await client.request("/api/auth/login", {
    method: "POST",
    body: { username: "test.user", password: TEST_PASSWORD },
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  const database = new DatabaseSync(client.databasePath);
  assert.ok(
    database.prepare("SELECT count(*) AS count FROM auth_limits").get().count >
      0,
  );
  database.close();
});
test("rotates the browser session on login and caps concurrent sessions", async (context) => {
  const client = await setup(context);
  const initial = await register(client);
  const rotated = await client.request("/api/auth/login", {
    method: "POST",
    cookie: initial,
    body: { username: "test.user", password: TEST_PASSWORD },
  });
  assert.equal(rotated.status, 200);
  assert.equal(
    (await client.request("/api/books", { cookie: initial })).status,
    401,
  );
  const receipts = [];
  for (let count = 0; count < AUTH_POLICY.maximumSessions; count++)
    receipts.push(await login(client));
  assert.equal(
    (
      await client.request("/api/books", {
        cookie: rotated.headers.get("set-cookie").split(";")[0],
      })
    ).status,
    401,
  );
  const latest = receipts.at(-1);
  const list = await (
    await client.request("/api/auth/sessions", { cookie: latest })
  ).json();
  assert.equal(list.sessions.length, AUTH_POLICY.maximumSessions);
  assert.equal(list.sessions.filter((item) => item.isCurrent).length, 1);
});
test("changes a password atomically and invalidates every old session", async (context) => {
  const client = await setup(context);
  const first = await register(client);
  const second = await login(client);
  const wrong = await client.request("/api/auth/password", {
    method: "POST",
    cookie: first,
    body: {
      currentPassword: "wrong-current-password",
      newPassword: "new-unique-password-123",
    },
  });
  assert.equal(wrong.status, 401);
  const updated = await client.request("/api/auth/password", {
    method: "POST",
    cookie: first,
    body: {
      currentPassword: TEST_PASSWORD,
      newPassword: "new-unique-password-123",
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(
    (await client.request("/api/books", { cookie: first })).status,
    401,
  );
  assert.equal(
    (await client.request("/api/books", { cookie: second })).status,
    401,
  );
  const fresh = updated.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await client.request("/api/books", { cookie: fresh })).status,
    200,
  );
  assert.equal(
    (
      await client.request("/api/auth/login", {
        method: "POST",
        body: { username: "test.user", password: TEST_PASSWORD },
      })
    ).status,
    401,
  );
  await login(client, "test.user", { password: "new-unique-password-123" });
});
test("revokes only sessions owned by the caller and requires the current password", async (context) => {
  const client = await setup(context);
  const first = await register(client);
  const second = await login(client);
  const other = await register(client, "other.user");
  const foreignId = client.sessions.get(other).session.id;
  assert.equal(
    (
      await client.request("/api/auth/sessions/" + foreignId, {
        method: "DELETE",
        cookie: first,
        body: { currentPassword: TEST_PASSWORD },
      })
    ).status,
    404,
  );
  assert.equal(
    (await client.request("/api/books", { cookie: other })).status,
    200,
  );
  const revoked = await client.request("/api/auth/logout-others", {
    method: "POST",
    cookie: first,
    body: { currentPassword: TEST_PASSWORD },
  });
  assert.equal((await revoked.json()).revoked, 1);
  assert.equal(
    (await client.request("/api/books", { cookie: second })).status,
    401,
  );
  assert.equal(
    (await client.request("/api/books", { cookie: first })).status,
    200,
  );
});
