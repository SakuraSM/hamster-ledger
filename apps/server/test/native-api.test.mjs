import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { setup, register, TEST_PASSWORD, EMPTY } from "./helpers.mjs";
function native(
  client,
  receipt,
  path,
  { method = "GET", body, headers = {} } = {},
) {
  return fetch(client.origin + "/api/native" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(receipt
        ? {
            Authorization: "Bearer " + receipt.accessToken,
            "X-CSRF-Token": receipt.csrfToken,
            "X-Hamster-User": receipt.user.id,
          }
        : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function nativeLogin(client, username = "test.user", extra = {}) {
  const response = await native(client, null, "/auth/login", {
    method: "POST",
    body: { username, password: TEST_PASSWORD, ...extra },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const receipt = await response.json();
  assert.match(receipt.accessToken, /^[A-Za-z0-9_-]{43}$/);
  return receipt;
}
test("native login uses independent bearer sessions and rejects cookie or browser origin", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const receipt = await nativeLogin(client);
  assert.equal((await native(client, receipt, "/books")).status, 200);
  assert.equal(
    (await native(client, null, "/books", { headers: { Cookie: cookie } }))
      .status,
    403,
  );
  assert.equal(
    (
      await native(client, receipt, "/books", {
        headers: { Origin: client.origin },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await native(client, receipt, "/books", {
        headers: { Cookie: "unrelated=1" },
      })
    ).status,
    403,
  );
  const cookieToken = cookie.slice(cookie.indexOf("=") + 1);
  assert.equal(
    (await native(client, { ...receipt, accessToken: cookieToken }, "/books"))
      .status,
    401,
  );
  assert.equal(
    (
      await client.request("/api/books", {
        cookie: "hamster_session=" + receipt.accessToken,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await client.request("/api/books", {
        headers: { Authorization: "Bearer " + receipt.accessToken },
      })
    ).status,
    401,
  );
  assert.equal((await client.request("/api/books", { cookie })).status, 200);
  const db = new DatabaseSync(client.databasePath);
  try {
    const row = db
      .prepare(
        "SELECT token_hash, transport, device_name FROM sessions WHERE id=?",
      )
      .get(receipt.session.id);
    assert.notEqual(row.token_hash, receipt.accessToken);
    assert.equal(row.transport, "native");
    assert.equal(row.device_name, "Android 应用");
  } finally {
    db.close();
  }
});
test("native books share snapshots with web and protect CAS revision and user binding", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const receipt = await nativeLogin(client);
  const input = { name: "Native QA", ledger: EMPTY };
  assert.equal(
    (
      await native(client, receipt, "/books", {
        method: "POST",
        body: input,
        headers: { "X-Hamster-User": "different-user" },
      })
    ).status,
    401,
  );
  const created = await native(client, receipt, "/books", {
    method: "POST",
    body: input,
  });
  assert.equal(created.status, 201);
  const book = await created.json();
  const webRead = await client.request("/api/books/" + book.id, { cookie });
  assert.equal(webRead.status, 200);
  assert.equal((await webRead.json()).name, input.name);
  const updated = await client.request("/api/books/" + book.id, {
    method: "PUT",
    cookie,
    body: { ...input, name: "Web edit", revision: 1 },
  });
  assert.equal(updated.status, 200);
  const conflict = await native(client, receipt, "/books/" + book.id, {
    method: "PUT",
    body: { ...input, revision: 1 },
  });
  assert.equal(conflict.status, 409);
  const after = await (
    await native(client, receipt, "/books/" + book.id)
  ).json();
  assert.equal(after.name, "Web edit");
  assert.equal(after.revision, 2);
});
test("native writes retain JSON and CSRF validation; cookie write-origin checks remain in force", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const receipt = await nativeLogin(client);
  assert.equal(
    (
      await native(client, receipt, "/books", {
        method: "POST",
        body: {},
        headers: { "Content-Type": "text/plain" },
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await native(client, receipt, "/books", {
        method: "POST",
        body: { name: "a", ledger: EMPTY },
        headers: { "X-CSRF-Token": "wrong" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await client.request("/api/books", {
        method: "POST",
        cookie,
        body: { name: "a", ledger: EMPTY },
        originOverride: "https://evil.example",
      })
    ).status,
    403,
  );
});
test("native password rotation revokes both transports and issues only a new native token", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const receipt = await nativeLogin(client);
  const response = await native(client, receipt, "/auth/password", {
    method: "POST",
    body: {
      currentPassword: TEST_PASSWORD,
      newPassword: "synthetic-new-password-456",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const rotated = await response.json();
  assert.notEqual(rotated.accessToken, receipt.accessToken);
  assert.equal((await native(client, rotated, "/books")).status, 200);
  assert.equal((await native(client, receipt, "/books")).status, 401);
  assert.equal((await client.request("/api/books", { cookie })).status, 401);
  const logout = await native(client, rotated, "/auth/logout", {
    method: "POST",
    body: {},
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.headers.get("set-cookie"), null);
  assert.equal((await native(client, rotated, "/books")).status, 401);
});
test("native logout cannot revoke a cookie token presented as bearer", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const receipt = await nativeLogin(client);
  const cookieToken = cookie.slice(cookie.indexOf("=") + 1);
  await native(
    client,
    { ...receipt, accessToken: cookieToken },
    "/auth/logout",
    { method: "POST", body: {} },
  );
  assert.equal((await client.request("/api/books", { cookie })).status, 200);
});
test("native session expiry leaves cloud books intact and requires new login", async (context) => {
  let now = Date.now();
  const client = await setup(context, { now: () => now });
  await register(client);
  const receipt = await nativeLogin(client);
  const created = await native(client, receipt, "/books", {
    method: "POST",
    body: { name: "Persistent", ledger: EMPTY },
  });
  const book = await created.json();
  now = receipt.session.expiresAt + 1;
  const expired = await native(client, receipt, "/books");
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).code, "session_expired");
  const renewed = await nativeLogin(client);
  assert.equal(
    (await native(client, renewed, "/books/" + book.id)).status,
    200,
  );
});
