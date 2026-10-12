import test from "node:test";
import assert from "node:assert/strict";
import { saveAdvancedEntry } from "@hamster-ledger/core";
import { setup, register, EMPTY } from "./helpers.mjs";
import { image, account } from "./ai-fixtures.mjs";
import { networkApi } from "../src/network-api.mjs";
import { attachmentsApi } from "../src/attachments.mjs";
async function fixture(context) {
  const client = await setup(context),
    cookie = await register(client),
    userId = client.sessions.get(cookie).user.id,
    database = await client.openDatabase();
  const uploaded = await (
    await client.request("/api/attachments", {
      cookie,
      method: "POST",
      body: image,
    })
  ).json();
  const ledger = saveAdvancedEntry(
    { ...EMPTY, accounts: [account] },
    {
      id: "conversion-qa",
      merchant: "Conversion QA",
      date: "2026-10-03 12:00:00",
      category: "餐饮",
      accountId: account.id,
      detail: {
        type: "expense",
        origin: "manual",
        attachmentIds: ["local:qa"],
        original: {
          currency: "CNY",
          minor: 1250,
          rate: "1",
          date: "2026-10-03",
          source: "manual",
        },
      },
    },
  );
  return {
    client,
    userId,
    database,
    uploaded,
    body: {
      confirm: true,
      name: "Conversion QA",
      ledger,
      attachmentMap: { "local:qa": uploaded.id },
    },
  };
}
async function convert({ database, userId, body }) {
  let status;
  try {
    await networkApi({
      database,
      userId,
      body,
      path: "/api/network/books",
      request: { method: "POST" },
      response: {
        writeHead(value) {
          status = value;
        },
        end() {},
      },
      readBody: async () => body,
      now: Date.now,
    });
  } catch (error) {
    status = error.status ?? 500;
  }
  return status;
}
function gateAttachmentReads(database) {
  let started = 0,
    release;
  const both = new Promise((resolve) => {
    release = resolve;
  });
  return {
    ...database,
    prepare(sql) {
      const query = database.prepare(sql);
      if (!sql.startsWith("SELECT id FROM attachments WHERE id=")) return query;
      return {
        ...query,
        async get(...values) {
          started++;
          if (started === 2) release();
          const row = await query.get(...values);
          await both;
          return row;
        },
      };
    },
  };
}
test(
  "two conversions cannot claim the same staged attachment",
  { timeout: 10000 },
  async (context) => {
    const f = await fixture(context),
      database = gateAttachmentReads(f.database);
    const result = await Promise.all([
      convert({ ...f, database }),
      convert({ ...f, database }),
    ]);
    assert.deepEqual(result.sort(), [201, 400]);
    assert.equal(
      (await f.database.prepare("SELECT count(*) AS total FROM books").get())
        .total,
      1,
    );
    const attachment = await f.database
      .prepare("SELECT book_id FROM attachments WHERE id=$1")
      .get(f.uploaded.id);
    const saved = await f.database
      .prepare("SELECT ledger FROM books WHERE id=$1")
      .get(attachment.book_id);
    assert.ok(
      JSON.parse(saved.ledger).records[0].detail.attachmentIds.includes(
        f.uploaded.id,
      ),
    );
  },
);
test(
  "staged attachment deletion cannot remove a conversion's claimed receipt",
  { timeout: 10000 },
  async (context) => {
    const f = await fixture(context);
    let selected, deleting;
    const ready = new Promise((resolve) => {
        selected = resolve;
      }),
      deletionStarted = new Promise((resolve) => {
        deleting = resolve;
      });
    const conversionDb = {
      ...f.database,
      prepare(sql) {
        const query = f.database.prepare(sql);
        if (!sql.startsWith("SELECT id FROM attachments WHERE id="))
          return query;
        return {
          ...query,
          async get(...values) {
            const row = await query.get(...values);
            selected();
            await deletionStarted;
            return row;
          },
        };
      },
    };
    const conversion = convert({ ...f, database: conversionDb });
    await ready;
    const database = await f.client.openDatabase(),
      deleteDb = {
        ...database,
        prepare(sql) {
          const query = database.prepare(sql);
          if (!sql.startsWith("SELECT * FROM attachments WHERE id="))
            return query;
          return {
            ...query,
            async get(...values) {
              deleting();
              return query.get(...values);
            },
          };
        },
      };
    const deletion = attachmentsApi({
      database: deleteDb,
      userId: f.userId,
      path: "/api/attachments/" + f.uploaded.id,
      request: { method: "DELETE" },
      response: { writeHead() {}, end() {} },
      readBody: async () => ({}),
      now: Date.now,
    }).then(
      () => 200,
      (error) => error.status,
    );
    assert.equal(await conversion, 201);
    assert.equal(await deletion, 404);
    assert.equal(
      (
        await database
          .prepare("SELECT count(*) AS total FROM attachments WHERE id=$1")
          .get(f.uploaded.id)
      ).total,
      1,
    );
  },
);
