import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { setup, register, EMPTY } from "./helpers.mjs";
import { requestModel } from "../src/model-transport.mjs";
import {
  saveAdvancedEntry,
  aiCandidateSchema,
  candidateEntry,
} from "@hamster-ledger/core";
const image = {
  id: "synthetic-voucher-image",
  name: "虚拟凭证.png",
  mime: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1X8AAAAASUVORK5CYII=",
};
const account = {
  id: "cash",
  name: "虚拟现金",
  kind: "asset",
  type: "现金",
  openingBalance: 10000,
  balanceAt: "2026-01-01 00:00:00",
};
const entry = {
  id: "virtual-expense",
  date: "2026-10-03 12:00:00",
  merchant: "虚拟餐馆",
  category: "餐饮",
  accountId: "cash",
  detail: {
    type: "expense",
    original: {
      minor: 1250,
      currency: "CNY",
      rate: "1",
      date: "2026-10-03",
      source: "manual",
    },
    attachmentIds: [image.id],
    splits: [],
    movements: [],
    origin: "manual",
  },
};
test("conversion atomically attaches uploaded images and rejects missing or foreign uploads", async (context) => {
  const client = await setup(context),
    cookie = await register(client),
    other = await register(client, "other.user");
  const ledger = saveAdvancedEntry({ ...EMPTY, accounts: [account] }, entry);
  const body = { confirm: true, name: "虚拟附件账本", ledger };
  assert.equal(
    (
      await client.request("/api/network/books", {
        cookie,
        method: "POST",
        body,
      })
    ).status,
    400,
  );
  const upload = await client.request("/api/attachments", {
    cookie,
    method: "POST",
    body: image,
  });
  assert.equal(upload.status, 201);
  const converted = await client.request("/api/network/books", {
    cookie,
    method: "POST",
    body: { ...body, attachmentMap: { [image.id]: image.id } },
  });
  assert.equal(converted.status, 201);
  const book = await converted.json();
  assert.equal(
    (
      await client.request(
        `/api/network/books/${book.id}/attachments/${image.id}`,
        { cookie },
      )
    ).status,
    200,
  );
  assert.equal(
    (await client.request(`/api/attachments/${image.id}`, { cookie })).status,
    404,
  );
  assert.equal(
    (
      await client.request("/api/network/books", {
        cookie: other,
        method: "POST",
        body: { ...body, attachmentMap: { [image.id]: image.id } },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await client.request(
        `/api/network/books/${book.id}/attachments/${image.id}`,
        { cookie: other },
      )
    ).status,
    404,
  );
});
test("confirmation retries keep a single record and preserve image references on confirmation", async (context) => {
  const client = await setup(context),
    cookie = await register(client);
  const draft = {
    id: "draft-one",
    sourceHash: "synthetic-hash",
    source: "text-rule",
    sourceLabel: "虚拟输入",
    createdAt: "2026-10-03",
    attachmentIds: [image.id],
    state: "pending",
    candidate: aiCandidateSchema.parse({
      type: "expense",
      amount: "12.50",
      date: "2026-10-03 12:00:00",
      merchant: "虚拟餐馆",
      accountId: "cash",
      category: "餐饮",
    }),
  };
  await client.request("/api/attachments", {
    cookie,
    method: "POST",
    body: image,
  });
  const book = await (
    await client.request("/api/network/books", {
      cookie,
      method: "POST",
      body: {
        confirm: true,
        name: "虚拟草稿",
        ledger: { ...EMPTY, accounts: [account], aiDrafts: [draft] },
        attachmentMap: { [image.id]: image.id },
      },
    })
  ).json();
  const body = {
    key: "synthetic-confirm-key",
    revision: book.revision,
    draftId: draft.id,
    entry: candidateEntry(draft),
  };
  for (let count = 0; count < 2; count++) {
    const response = await client.request(
      `/api/network/books/${book.id}/ai/confirm`,
      { cookie, method: "POST", body },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ledger.records.length, 1);
    assert.deepEqual(result.ledger.records[0].detail.attachmentIds, [image.id]);
  }
});
test("HTTP model transport bounds time, refuses redirects, and reports provider rate limits", async (context) => {
  const server = createServer((request, response) => {
    if (request.url === "/slow") return;
    if (request.url === "/limited") {
      response.writeHead(429);
      response.end("limited");
      return;
    }
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "http://169.254.169.254/" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"data":[{"id":"synthetic-model"}]}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const config = {
    endpoint: `http://127.0.0.1:${server.address().port}`,
    allowLan: true,
  };
  const result = await requestModel({ config, key: "", path: "/models" });
  assert.equal(result.data[0].id, "synthetic-model");
  await assert.rejects(
    requestModel({ config, key: "", path: "/limited" }),
    (error) => error.status === 429,
  );
  await assert.rejects(
    requestModel({ config, key: "", path: "/redirect" }),
    (error) => error.status === 502,
  );
  await assert.rejects(
    requestModel({ config, key: "", path: "/slow", timeoutMs: 50 }),
    (error) => error.status === 504,
  );
});
