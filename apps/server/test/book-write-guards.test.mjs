import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import { migrateLedger } from "@hamster-ledger/core";
import { setup, register, EMPTY } from "./helpers.mjs";
import { createApi } from "../src/api.mjs";

for (const authority of ["snapshot", "server"]) {
  test(`legacy snapshot writes recheck ${authority} state after reading the body`, async (context) => {
    const client = await setup(context);
    const cookie = await register(client);
    const original = await (
      await client.request("/api/books", {
        cookie,
        method: "POST",
        body: { name: "虚拟旧账本", ledger: EMPTY },
      })
    ).json();
    const session = client.sessions.get(cookie);
    const database = new DatabaseSync(client.databasePath);
    context.after(() => database.close());
    const upgraded = JSON.stringify(migrateLedger(EMPTY));
    const request = new Readable({
      read() {
        database
          .prepare(
            "UPDATE books SET authority=?,ledger=?,revision=2 WHERE id=?",
          )
          .run(authority, upgraded, original.id);
        this.push(
          JSON.stringify({ name: "过期写入", ledger: EMPTY, revision: 2 }),
        );
        this.push(null);
      },
    });
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
    await assert.rejects(
      createApi({ database })(request, { writeHead() {}, end() {} }),
      (error) => error.status === 426,
    );
    const saved = database
      .prepare("SELECT ledger,revision FROM books WHERE id=?")
      .get(original.id);
    assert.equal(saved.revision, 2);
    assert.equal(saved.ledger, upgraded);
  });
}
