import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { setup, register, EMPTY } from "./helpers.mjs";
import { book, path } from "./ai-fixtures.mjs";
import { createApi } from "../src/api.mjs";
import { tokensApi } from "../src/open-tokens.mjs";
test(
  "snapshot writes cannot overwrite a conversion committed while waiting for its row",
  { timeout: 10000 },
  async (context) => {
    const client = await setup(context),
      cookie = await register(client);
    const original = await (
      await client.request("/api/books", {
        cookie,
        method: "POST",
        body: { name: "Conversion QA", ledger: EMPTY },
      })
    ).json();
    const session = client.sessions.get(cookie),
      database = await client.openDatabase(),
      converter = await client.openDatabase();
    let release, acquired, reached;
    const holding = new Promise((resolve) => {
        release = resolve;
      }),
      locked = new Promise((resolve) => {
        acquired = resolve;
      }),
      writing = new Promise((resolve) => {
        reached = resolve;
      });
    const conversion = converter.transaction(async () => {
      await converter.lockBook(original.id);
      await converter
        .prepare("UPDATE books SET authority='server',revision=2 WHERE id=$1")
        .run(original.id);
      acquired();
      await holding;
    });
    await locked;
    const guarded = {
      ...database,
      async lockBook(id) {
        reached();
        return database.lockBook(id);
      },
      prepare(sql) {
        const query = database.prepare(sql);
        if (!sql.startsWith("UPDATE books SET name=")) return query;
        return {
          ...query,
          async run(...values) {
            reached();
            await conversion;
            return query.run(...values);
          },
        };
      },
    };
    const request = Readable.from([
      Buffer.from(
        JSON.stringify({ name: "Stale QA", ledger: EMPTY, revision: 2 }),
      ),
    ]);
    request.url = `/api/books/${original.id}`;
    request.method = "PUT";
    request.headers = {
      host: new URL(client.origin).host,
      origin: client.origin,
      cookie,
      "content-type": "application/json",
      "x-hamster-client": "1",
      "x-hamster-user": session.user.id,
      "x-csrf-token": session.csrfToken,
    };
    const result = createApi({ database: guarded })(request, {
      writeHead() {},
      end() {},
    }).then(
      () => ({ status: 200 }),
      (error) => ({ status: error.status }),
    );
    try {
      await writing;
    } finally {
      release();
    }
    await conversion;
    assert.equal((await result).status, 426);
    const saved = await database
      .prepare("SELECT revision,authority FROM books WHERE id=$1")
      .get(original.id);
    assert.deepEqual(saved, { revision: 2, authority: "server" });
  },
);
test("write token creation rechecks a role downgraded before the transaction", async (context) => {
  const client = await setup(context),
    cookie = await register(client),
    snapshot = await book(client, cookie),
    database = await client.openDatabase(),
    userId = client.sessions.get(cookie).user.id;
  let changed = false;
  const guarded = {
    ...database,
    async transaction(action) {
      if (!changed) {
        changed = true;
        await database
          .prepare(
            "UPDATE book_members SET role='viewer' WHERE book_id=$1 AND user_id=$2",
          )
          .run(snapshot.id, userId);
      }
      return database.transaction(action);
    },
  };
  await assert.rejects(
    tokensApi({
      database: guarded,
      path: path(snapshot, "/tokens"),
      request: { method: "POST" },
      response: { writeHead() {}, end() {} },
      userId,
      now: Date.now,
      readBody: async () => ({ name: "Role QA", scopes: ["records:write"] }),
    }),
    (error) => error.status === 403,
  );
  assert.equal(
    (
      await database
        .prepare("SELECT count(*) AS total FROM open_tokens WHERE book_id=$1")
        .get(snapshot.id)
    ).total,
    0,
  );
});
