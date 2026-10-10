import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { setup, register } from "./helpers.mjs";
import { book, image, path } from "./ai-fixtures.mjs";
import { attachmentsApi } from "../src/attachments.mjs";

for (const scenario of [
  { before: "member", after: "viewer", own: true },
  { before: "admin", after: "member", own: false },
]) {
  test(`attachment deletion rechecks ${scenario.before} to ${scenario.after} role changes while reading the body`, async (context) => {
    const client = await setup(context);
    const ownerCookie = await register(client);
    const memberCookie = await register(client, "attachment.member");
    const current = await book(client, ownerCookie);
    const invitation = await (
      await client.request(path(current, "/invites"), {
        cookie: ownerCookie,
        method: "POST",
        body: { role: scenario.before },
      })
    ).json();
    await client.request("/api/network/invites/accept", {
      cookie: memberCookie,
      method: "POST",
      body: { code: invitation.code },
    });
    const uploaded = await (
      await client.request(path(current, "/attachments"), {
        cookie: scenario.own ? memberCookie : ownerCookie,
        method: "POST",
        body: image,
      })
    ).json();
    const memberId = client.sessions.get(memberCookie).user.id;
    const database = new DatabaseSync(client.databasePath);
    context.after(() => database.close());
    await assert.rejects(
      attachmentsApi({
        database,
        path: path(current, `/attachments/${uploaded.id}`),
        request: { method: "DELETE" },
        response: { writeHead() {}, end() {} },
        userId: memberId,
        now: Date.now,
        readBody: async () => {
          database
            .prepare(
              "UPDATE book_members SET role=? WHERE book_id=? AND user_id=?",
            )
            .run(scenario.after, current.id, memberId);
          return {};
        },
      }),
      (error) => error.status === 403,
    );
    assert.ok(
      database
        .prepare("SELECT id FROM attachments WHERE id=?")
        .get(uploaded.id),
    );
  });
}
