import test from "node:test";
import assert from "node:assert/strict";
import { setup, register, EMPTY } from "./helpers.mjs";
const path = (id, rest = "") => `/api/network/books/${id}${rest}`;
async function create(client, cookie, extra = {}) {
  const response = await client.request("/api/network/books", {
    method: "POST",
    cookie,
    body: { name: "虚拟家庭账本", ledger: EMPTY, confirm: true, ...extra },
  });
  assert.equal(response.status, 201);
  return response.json();
}
async function invite(client, cookie, bookId, role = "member") {
  const response = await client.request(path(bookId, "/invites"), {
    method: "POST",
    cookie,
    body: { role },
  });
  assert.equal(response.status, 201);
  return response.json();
}
const record = (id, amount = 100) => ({
  id,
  date: "2026-10-03 12:00:00",
  merchant: "虚拟小店",
  description: "测试消费",
  amount,
  currency: "CNY",
  kind: "支出",
  category: "其他",
  source: "手动记账",
  account: "",
  orderId: "",
  status: "confirmed",
  sourceStatus: "测试",
  fileName: "测试",
  raw: {},
  linkedSources: [],
});
const patch = (value) => ({
  changes: [{ collection: "records", id: value.id, value }],
});
async function operation(client, cookie, book, value, key = "synthetic-key-1") {
  return client.request(path(book.id, "/operations"), {
    method: "POST",
    cookie,
    body: { key, revision: book.revision, patch: patch(value) },
  });
}
test("conversion requires matching snapshots, retains a backup and closes legacy writes", async (context) => {
  const client = await setup(context),
    cookie = await register(client);
  const old = await (
    await client.request("/api/books", {
      method: "POST",
      cookie,
      body: { name: "旧账本", ledger: EMPTY },
    })
  ).json();
  const conflict = await client.request("/api/network/books", {
    method: "POST",
    cookie,
    body: {
      name: "新账本",
      ledger: { ...EMPTY, rules: { x: "其他" } },
      sourceBookId: old.id,
      revision: old.revision,
      confirm: true,
    },
  });
  assert.equal(conflict.status, 409);
  const book = await create(client, cookie, {
    sourceBookId: old.id,
    revision: old.revision,
  });
  assert.equal(book.ledger.version, 2);
  const backup = await (
    await client.request(path(book.id, "/backup"), { cookie })
  ).json();
  assert.equal(backup.ledger.version, 1);
  assert.equal(
    (
      await client.request(`/api/books/${book.id}`, {
        method: "PUT",
        cookie,
        body: { revision: book.revision, name: "旧覆盖", ledger: EMPTY },
      })
    ).status,
    426,
  );
});
test("simultaneous operations use revisions and repeated request keys never duplicate transactions", async (context) => {
  const client = await setup(context),
    cookie = await register(client),
    book = await create(client, cookie);
  const results = await Promise.all([
    operation(client, cookie, book, record("first"), "synthetic-first"),
    operation(client, cookie, book, record("second"), "synthetic-second"),
  ]);
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 409],
  );
  const winnerIndex = results.findIndex((response) => response.ok),
    winner = await results[winnerIndex].json();
  const winnerRecord = winner.ledger.records[0];
  const retry = await operation(
    client,
    cookie,
    book,
    winnerRecord.id === "first" ? record("first") : record("second"),
    winnerRecord.id === "first" ? "synthetic-first" : "synthetic-second",
  );
  assert.equal(retry.status, 200);
  const latest = await (await client.request(path(book.id), { cookie })).json();
  assert.equal(latest.ledger.records.length, 1);
  assert.equal(latest.revision, book.revision + 1);
  const changed = await operation(
    client,
    cookie,
    latest,
    record("different"),
    winnerRecord.id === "first" ? "synthetic-first" : "synthetic-second",
  );
  assert.equal(changed.status, 409);
});
test("single-use invitations and member ownership are enforced, removal revokes access", async (context) => {
  const client = await setup(context),
    owner = await register(client),
    member = await register(client, "member.user"),
    outsider = await register(client, "outside.user");
  const book = await create(client, owner),
    invitation = await invite(client, owner, book.id);
  assert.equal(
    (await client.request(path(book.id), { cookie: member })).status,
    404,
  );
  const join = {
    method: "POST",
    cookie: member,
    body: { code: invitation.code },
  };
  assert.equal(
    (await client.request("/api/network/invites/accept", join)).status,
    200,
  );
  assert.equal(
    (
      await client.request("/api/network/invites/accept", {
        ...join,
        cookie: outsider,
      })
    ).status,
    400,
  );
  const owned = await (
    await operation(client, owner, book, record("owners"))
  ).json();
  assert.equal(
    (
      await operation(
        client,
        member,
        owned,
        record("owners", 500),
        "members-change",
      )
    ).status,
    400,
  );
  const memberWrite = await operation(
    client,
    member,
    owned,
    record("members"),
    "members-write",
  );
  assert.equal(memberWrite.status, 200);
  const userId = client.sessions.get(member).user.id;
  const data = await memberWrite.json();
  assert.equal(
    data.ledger.records.find((item) => item.id === "members").detail.memberId,
    userId,
  );
  assert.equal(
    (
      await client.request(path(book.id, `/members/${userId}`), {
        method: "DELETE",
        cookie: owner,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await client.request(path(book.id), { cookie: member })).status,
    404,
  );
});
test("viewer cannot write, revoked invitations fail, undo appends history", async (context) => {
  const client = await setup(context),
    owner = await register(client),
    viewer = await register(client, "viewer.user"),
    book = await create(client, owner);
  const canceled = await invite(client, owner, book.id);
  await client.request(path(book.id, `/invites/${canceled.id}`), {
    method: "DELETE",
    cookie: owner,
    body: {},
  });
  assert.equal(
    (
      await client.request("/api/network/invites/accept", {
        method: "POST",
        cookie: viewer,
        body: { code: canceled.code },
      })
    ).status,
    400,
  );
  const invitation = await invite(client, owner, book.id, "viewer");
  await client.request("/api/network/invites/accept", {
    method: "POST",
    cookie: viewer,
    body: { code: invitation.code },
  });
  assert.equal(
    (await operation(client, viewer, book, record("forbidden"))).status,
    403,
  );
  const changed = await (
    await operation(client, owner, book, record("one"))
  ).json();
  const undo = await client.request(path(book.id, "/operations"), {
    method: "POST",
    cookie: owner,
    body: {
      key: "synthetic-undo",
      revision: changed.revision,
      undoId: changed.operationId,
    },
  });
  // An undo uses a tombstone rather than physically removing a financial record.
  assert.equal(undo.status, 200);
  const history = await (
    await client.request(path(book.id, "/history"), { cookie: owner })
  ).json();
  assert.equal(
    history.history.filter((item) => item.source === "app").length,
    2,
  );
  assert.equal(
    history.history.filter((item) => item.source === "membership").length,
    4,
  );
});
test("ownership transfer changes management authority and member exit removes access", async (context) => {
  const client = await setup(context),
    owner = await register(client),
    member = await register(client, "successor.user");
  const book = await create(client, owner),
    invitation = await invite(client, owner, book.id);
  await client.request("/api/network/invites/accept", {
    method: "POST",
    cookie: member,
    body: { code: invitation.code },
  });
  const memberId = client.sessions.get(member).user.id;
  const transfer = await client.request(path(book.id, "/owner"), {
    method: "PUT",
    cookie: owner,
    body: { userId: memberId },
  });
  assert.equal(transfer.status, 200);
  assert.equal(
    (await (await client.request(path(book.id), { cookie: member })).json())
      .role,
    "owner",
  );
  assert.equal(
    (
      await client.request(path(book.id), {
        method: "DELETE",
        cookie: owner,
        body: { confirm: true },
      })
    ).status,
    403,
  );
  const oldOwnerId = client.sessions.get(owner).user.id;
  assert.equal(
    (
      await client.request(path(book.id, `/members/${oldOwnerId}`), {
        method: "DELETE",
        cookie: owner,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await client.request(path(book.id), { cookie: owner })).status,
    404,
  );
  assert.equal(
    (
      await client.request(path(book.id), {
        method: "DELETE",
        cookie: member,
        body: { confirm: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await client.request(path(book.id), { cookie: member })).status,
    404,
  );
});
test("client supplied legacy movements are discarded and expired invitations cannot be used", async (context) => {
  let time = Date.UTC(2026, 9, 3);
  const client = await setup(context, { now: () => time }),
    owner = await register(client);
  const book = await create(client, owner);
  const forged = record("forged");
  forged.detail = {
    type: "income",
    origin: "legacy",
    original: {
      minor: 999999,
      currency: "CNY",
      rate: "1",
      date: "2026-10-03",
      source: "legacy",
    },
    movements: [{ accountId: "anything", amount: 999999 }],
    splits: [],
    attachmentIds: [],
  };
  const written = await operation(client, owner, book, forged);
  assert.equal(written.status, 200);
  const saved = (await written.json()).ledger.records[0];
  assert.equal(saved.detail.type, "expense");
  assert.equal(saved.detail.original.minor, 100);
  assert.deepEqual(saved.detail.movements, []);
  const invitation = await invite(client, owner, book.id);
  time += 8 * 24 * 60 * 60 * 1000;
  const member = await register(client, "late.user");
  assert.equal(
    (
      await client.request("/api/network/invites/accept", {
        method: "POST",
        cookie: member,
        body: { code: invitation.code },
      })
    ).status,
    400,
  );
});
