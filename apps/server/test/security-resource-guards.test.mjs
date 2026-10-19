import { EMPTY_LEDGER, saveEntry } from "@hamster-ledger/core";
import test from "node:test";
import assert from "node:assert/strict";
import { setup, register } from "./helpers.mjs";
import { book, image, profile } from "./ai-fixtures.mjs";
import { storeAttachment } from "../src/attachments.mjs";
import {
  assertModelPolicy,
  parseModelLanOrigins,
  requestModel,
} from "../src/model-transport.mjs";

test("LAN access needs an operator allowlist, including existing saved profiles", async (context) => {
  let calls = 0;
  const client = await setup(context, {
    modelTransport: async () => {
      calls++;
      return { data: [] };
    },
  });
  const cookie = await register(client);
  const denied = await client.request("/api/models/profile", {
    cookie,
    method: "PUT",
    body: {
      endpoint: "http://127.0.0.1:9988/v1",
      allowLan: true,
      noKey: true,
    },
  });
  assert.equal(denied.status, 403);
  await profile(client, cookie);
  const database = await client.openDatabase();
  await database.prepare("UPDATE model_profiles SET configuration=$1").run(
    JSON.stringify({
      endpoint: "http://127.0.0.1:9988/v1",
      allowLan: true,
      noKey: true,
    }),
  );
  assert.equal(
    (await client.request("/api/models/list", { cookie })).status,
    403,
  );
  assert.equal(calls, 0);
});

test("operator authorization is exact by origin and does not disable metadata protection", async () => {
  const origins = parseModelLanOrigins(
    "http://127.0.0.1:9988, https://model.internal:443",
  );
  assert.doesNotThrow(() =>
    assertModelPolicy(
      { endpoint: "http://127.0.0.1:9988/v1", allowLan: true },
      origins,
    ),
  );
  assert.throws(() =>
    assertModelPolicy(
      { endpoint: "http://127.0.0.1:9989/v1", allowLan: true },
      origins,
    ),
  );
  assert.throws(() => parseModelLanOrigins("http://127.0.0.1:9988/v1"));
  await assert.rejects(
    requestModel({
      config: { endpoint: "http://169.254.169.254", allowLan: true },
      key: "",
      path: "/models",
      modelLanOrigins: ["http://169.254.169.254"],
    }),
    /网络范围/,
  );
  await assert.rejects(
    requestModel({
      config: { endpoint: "http://127.0.0.1:9988", allowLan: true },
      key: "",
      path: "/models",
    }),
    /管理员/,
  );
});

for (const personal of [false, true]) {
  test(`user quota is atomic across ${personal ? "personal and network" : "two network"} uploads`, async (context) => {
    const client = await setup(context);
    const cookie = await register(client);
    const first = await book(client, cookie);
    const second = personal ? null : await book(client, cookie);
    const userId = client.sessions.get(cookie).user.id;
    const database = await client.openDatabase();
    const other = await client.openDatabase();
    const maximum = 100 * 1024 * 1024;
    const size = Buffer.from(image.base64, "base64").length;
    // Synthetic occupancy leaves room for exactly one of two concurrent PNGs.
    await database.query(
      "INSERT INTO attachments VALUES($1,NULL,$2,'image/png','synthetic quota fixture','seed',decode(repeat('00',$3),'hex'),$4)",
      ["quota-seed", userId, maximum - size, Date.now()],
    );
    const results = await Promise.allSettled([
      storeAttachment({
        database,
        userId,
        bookId: first.id,
        body: { ...image, id: "quota-image-one" },
        now: Date.now,
      }),
      storeAttachment({
        database: other,
        userId,
        bookId: second?.id ?? null,
        body: { ...image, id: "quota-image-two" },
        now: Date.now,
      }),
    ]);
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const failure = results.find((result) => result.status === "rejected");
    assert.equal(failure.reason.status, 413);
    const row = await database
      .prepare(
        "SELECT SUM(length(bytes)) AS total FROM attachments WHERE user_id=$1",
      )
      .get(userId);
    assert.equal(row.total, maximum);
  });
}

test("aggregate overflow cannot persist through snapshot or network writes", async (context) => {
  const client = await setup(context);
  const cookie = await register(client);
  const base = saveEntry(EMPTY_LEDGER, {
    id: "synthetic-overflow",
    date: "2026-10-19 12:00:00",
    merchant: "合成金额",
    amount: Number.MAX_SAFE_INTEGER,
    kind: "支出",
    category: "餐饮",
    description: "",
    tags: [],
    accountId: null,
    transferToAccountId: null,
  }).records[0];
  const records = [
    base,
    { ...base, id: "synthetic-overflow-2", amount: 1, detail: undefined },
  ];
  const snapshot = await client.request("/api/books", {
    cookie,
    method: "POST",
    body: { name: "合成溢出", ledger: { ...EMPTY_LEDGER, records } },
  });
  assert.equal(snapshot.status, 400);
  const current = await book(client, cookie);
  const changed = await client.request(
    `/api/network/books/${current.id}/operations`,
    {
      cookie,
      method: "POST",
      body: {
        key: "aggregate-boundary",
        revision: current.revision,
        patch: {
          changes: records.map((value) => ({
            collection: "records",
            id: value.id,
            value,
          })),
        },
      },
    },
  );
  assert.equal(changed.status, 400);
  const latest = await (
    await client.request(`/api/network/books/${current.id}`, { cookie })
  ).json();
  assert.equal(latest.revision, current.revision);
  assert.deepEqual(latest.ledger.records, []);
});
