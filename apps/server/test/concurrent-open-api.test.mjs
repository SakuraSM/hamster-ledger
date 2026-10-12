import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { setup, register } from "./helpers.mjs";
import { book, image, path } from "./ai-fixtures.mjs";
import { openApi } from "../src/open-api.mjs";
const entry = {
  date: "2026-10-03 12:00:00",
  merchant: "Concurrent QA",
  category: "餐饮",
  accountId: "cash",
  detail: {
    type: "expense",
    original: {
      currency: "CNY",
      minor: 1250,
      rate: "1",
      date: "2026-10-03",
      source: "manual",
    },
  },
};
async function fixture(context) {
  const client = await setup(context),
    cookie = await register(client),
    snapshot = await book(client, cookie);
  const minted = await client.request(path(snapshot, "/tokens"), {
    cookie,
    method: "POST",
    body: {
      name: "Concurrent QA",
      scopes: ["records:write", "attachments:write"],
    },
  });
  const token = await minted.json(),
    database = await client.openDatabase();
  return { client, snapshot, token, database };
}
function concurrentRead(database, sqlFragment) {
  let arrivals = 0,
    release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  return {
    ...database,
    prepare(sql) {
      const query = database.prepare(sql);
      if (!sql.includes(sqlFragment)) return query;
      return {
        ...query,
        async get(...values) {
          const result = await query.get(...values);
          if (!database.isInTransaction() && arrivals < 2) {
            arrivals++;
            if (arrivals === 2) release();
            await ready;
          }
          return result;
        },
      };
    },
  };
}
async function invoke({ database, token, route, body }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.url = "/api/open/v1" + route;
  request.method = "POST";
  request.headers = {
    authorization: "Bearer " + token.token,
    "content-type": "application/json",
    "idempotency-key": "concurrent-qa-key",
  };
  const result = {};
  const response = {
    writeHead(status) {
      result.status = status;
    },
    end(value) {
      result.body = JSON.parse(value);
    },
  };
  try {
    await openApi({ database, token, request, response, now: Date.now });
  } catch (error) {
    result.status = error.status ?? 500;
    result.body = { error: error.message };
  }
  return result;
}
test(
  "concurrent record replay returns the same complete receipt",
  { timeout: 10000 },
  async (context) => {
    const f = await fixture(context),
      database = concurrentRead(
        f.database,
        "SELECT digest,result FROM book_requests",
      ),
      body = { revision: f.snapshot.revision, entry };
    const results = await Promise.all([
      invoke({ ...f, database, route: "/records", body }),
      invoke({ ...f, database, route: "/records", body }),
    ]);
    assert.deepEqual(
      results.map((result) => result.status),
      [201, 201],
    );
    assert.ok(results[0].body.record?.id);
    assert.deepEqual(results[0].body, results[1].body);
    const saved = await f.database
      .prepare("SELECT ledger FROM books WHERE id=$1")
      .get(f.snapshot.id);
    assert.equal(JSON.parse(saved.ledger).records.length, 1);
  },
);
for (const isDifferent of [false, true]) {
  test(
    `concurrent attachment ${isDifferent ? "conflict rolls back" : "replay audits once"}`,
    { timeout: 10000 },
    async (context) => {
      const f = await fixture(context),
        database = concurrentRead(f.database, "SELECT * FROM open_requests"),
        body = { ...image, id: "concurrent-attachment-first" };
      const results = await Promise.all([
        invoke({ ...f, database, route: "/attachments", body }),
        invoke({
          ...f,
          database,
          route: "/attachments",
          body: isDifferent
            ? { ...body, id: "concurrent-attachment-second" }
            : body,
        }),
      ]);
      assert.deepEqual(
        results.map((result) => result.status).sort(),
        isDifferent ? [201, 409] : [201, 201],
      );
      if (!isDifferent) assert.deepEqual(results[0].body, results[1].body);
      const count = await f.database
        .prepare("SELECT count(*) AS total FROM attachments WHERE book_id=$1")
        .get(f.snapshot.id);
      assert.equal(count.total, 1);
      const audit = await f.database
        .prepare(
          "SELECT count(*) AS total FROM book_operations WHERE book_id=$1 AND summary='通过 API 上传附件'",
        )
        .get(f.snapshot.id);
      assert.equal(audit.total, 1);
    },
  );
}
