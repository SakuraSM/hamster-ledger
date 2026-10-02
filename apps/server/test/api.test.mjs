import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, register, EMPTY } from "./helpers.mjs";
test("isolates users, rejects stale writes, and invalidates logout sessions", async (context) => {
  const client = await setup(context);
  const alice = await register(client, "test.alice");
  const bob = await register(client, "test.bob");
  const created = await client.request("/api/books", {
    method: "POST",
    cookie: alice,
    body: { name: "测试账本", ledger: EMPTY },
  });
  assert.equal(created.status, 201);
  const book = await created.json();
  assert.equal(
    (await client.request("/api/books/" + book.id, { cookie: bob })).status,
    404,
  );
  assert.deepEqual(
    await (await client.request("/api/books", { cookie: bob })).json(),
    { books: [] },
  );
  const first = await client.request("/api/books/" + book.id, {
    method: "PUT",
    cookie: alice,
    body: {
      name: "更新",
      ledger: { ...EMPTY, rules: { 测试: "餐饮" } },
      revision: 1,
    },
  });
  assert.equal(first.status, 200);
  const stale = await client.request("/api/books/" + book.id, {
    method: "PUT",
    cookie: alice,
    body: { name: "覆盖", ledger: EMPTY, revision: 1 },
  });
  assert.equal(stale.status, 409);
  const current = await (
    await client.request("/api/books/" + book.id, { cookie: alice })
  ).json();
  assert.equal(current.revision, 2);
  assert.deepEqual(current.ledger.rules, { 测试: "餐饮" });
  await client.request("/api/auth/logout", {
    method: "POST",
    cookie: alice,
    body: {},
  });
  assert.equal(
    (await client.request("/api/books", { cookie: alice })).status,
    401,
  );
});
test("validates origins, credentials, schemas and session boundaries", async (context) => {
  const client = await setup(context);
  assert.equal(
    (
      await client.request("/api/auth/register", {
        method: "POST",
        originOverride: "https://attacker.example",
        body: { username: "any.user", password: "long-enough-password" },
      })
    ).status,
    403,
  );
  const cookie = await register(client, "test.validation");
  assert.equal(
    (
      await client.request("/api/auth/login", {
        method: "POST",
        body: { username: "test.validation", password: "incorrect-password" },
      })
    ).status,
    401,
  );
  const login = await client.request("/api/auth/login", {
    method: "POST",
    body: {
      username: "test.validation",
      password: "synthetic-test-password-123",
    },
  });
  assert.equal(login.status, 200);
  assert.equal(
    (
      await client.request("/api/books", {
        method: "POST",
        cookie,
        body: { name: "坏格式", ledger: { version: 999 } },
      })
    ).status,
    400,
  );
  assert.equal((await client.request("/api/books")).status, 401);
});
test("two racing clients cannot both commit the same revision", async (context) => {
  const client = await setup(context);
  const cookie = await register(client, "test.race");
  const book = await (
    await client.request("/api/books", {
      method: "POST",
      cookie,
      body: { name: "并发", ledger: EMPTY },
    })
  ).json();
  const responses = await Promise.all(
    ["版本 A", "版本 B"].map((name) =>
      client.request("/api/books/" + book.id, {
        method: "PUT",
        cookie,
        body: { name, ledger: EMPTY, revision: 1 },
      }),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
});
test("rejects invalid transaction dates without storing or advancing a book", async (context) => {
  const client = await setup(context);
  const cookie = await register(client, "test.date.validation");
  const record = {
    id: "bill",
    date: "2026-09-20 12:00:00",
    merchant: "合成账单",
    description: "",
    amount: 100,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "手动记账",
    account: "",
    orderId: "",
    status: "confirmed",
    sourceStatus: "测试",
    fileName: "测试",
    raw: {},
    linkedSources: [],
  };
  const good = { ...EMPTY, records: [record] };
  const bad = {
    ...good,
    records: [{ ...record, date: "2026-02-30 12:00:00" }],
  };
  const created = await client.request("/api/books", {
    method: "POST",
    cookie,
    body: { name: "日期校验", ledger: good },
  });
  const book = await created.json();
  assert.equal(
    (
      await client.request("/api/books", {
        method: "POST",
        cookie,
        body: { name: "无效日期", ledger: bad },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await client.request("/api/books/" + book.id, {
        method: "PUT",
        cookie,
        body: { name: "日期校验", revision: 1, ledger: bad },
      })
    ).status,
    400,
  );
  const saved = await (
    await client.request("/api/books/" + book.id, { cookie })
  ).json();
  assert.equal(saved.revision, 1);
  assert.equal(saved.ledger.records[0].date, record.date);
});
