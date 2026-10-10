import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { setup, register } from "./helpers.mjs";
import {
  book,
  image,
  path,
  profile,
  entry as candidate,
} from "./ai-fixtures.mjs";
const SCOPES = [
  "records:read",
  "records:write",
  "ai:recognize",
  "ai:confirm",
  "attachments:read",
  "attachments:write",
];
const entry = {
  date: "2026-10-03 12:00:00",
  merchant: "虚拟 API 商户",
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
async function fixture(context, options) {
  const client = await setup(context, options),
    cookie = await register(client),
    ledger = await book(client, cookie);
  const mint = async (scopes = SCOPES, days = 30) => {
    const response = await client.request(path(ledger, "/tokens"), {
      cookie,
      method: "POST",
      body: { name: "虚拟机器人", scopes, days },
    });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  const token = await mint();
  const call = (
    route,
    {
      bearer = token.token,
      method = "GET",
      body,
      key = "synthetic-open-request",
      headers = {},
    } = {},
  ) =>
    fetch(client.origin + "/api/open/v1" + route, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { ...client, cookie, ledger, mint, token, call };
}
test("open token plaintext is only returned once; browser credentials and insufficient scopes are rejected", async (context) => {
  const f = await fixture(context),
    db = new DatabaseSync(f.databasePath);
  context.after(() => db.close());
  const row = db
    .prepare("SELECT * FROM open_tokens WHERE id=?")
    .get(f.token.id);
  assert.notEqual(row.token_hash, f.token.token);
  assert.equal(row.token_hash.length, 64);
  const list = await (
    await f.request(path(f.ledger, "/tokens"), { cookie: f.cookie })
  ).json();
  assert.equal(JSON.stringify(list).includes(f.token.token), false);
  assert.equal(JSON.stringify(list).includes(row.token_hash), false);
  assert.equal((await f.call("/ping")).status, 200);
  assert.equal(
    (await f.call("/ping", { headers: { Cookie: f.cookie } })).status,
    403,
  );
  assert.equal(
    (await f.call("/ping", { headers: { Origin: f.origin } })).status,
    403,
  );
  assert.equal((await f.call("/ping", { bearer: "invalid" })).status, 401);
  const read = await f.mint(["records:read"]);
  assert.equal((await f.call("/records", { bearer: read.token })).status, 200);
  assert.equal(
    (
      await f.call("/records", {
        bearer: read.token,
        method: "POST",
        body: { revision: 1, entry },
      })
    ).status,
    403,
  );
});
test("record creation uses ledger validation, CAS, durable idempotency and API audit", async (context) => {
  const f = await fixture(context),
    body = { revision: f.ledger.revision, entry };
  const first = await f.call("/records", { method: "POST", body });
  assert.equal(first.status, 201, await first.clone().text());
  const result = await first.json();
  assert.equal(result.record.amount, 1250);
  assert.equal(result.record.detail.origin, "api");
  const repeat = await f.call("/records", { method: "POST", body });
  assert.deepEqual(await repeat.json(), result);
  assert.equal(repeat.headers.get("idempotency-replayed"), "true");
  assert.equal(
    (
      await f.call("/records", {
        method: "POST",
        body: { ...body, entry: { ...entry, merchant: "变更" } },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call("/records", {
        method: "POST",
        key: "synthetic-stale-write",
        body,
      })
    ).status,
    409,
  );
  const invalid = structuredClone(entry);
  invalid.detail.original.minor = -1;
  assert.equal(
    (
      await f.call("/records", {
        method: "POST",
        key: "synthetic-invalid-money",
        body: { revision: result.revision, entry: invalid },
      })
    ).status,
    400,
  );
  const list = await (await f.call("/records?limit=1")).json();
  assert.equal(list.total, 1);
  assert.equal(list.records[0].id, result.record.id);
  assert.equal(
    (await f.call(`/records?revision=${f.ledger.revision}`)).status,
    409,
  );
  const history = await (
    await f.request(path(f.ledger, "/history"), { cookie: f.cookie })
  ).json();
  assert.ok(history.history.some((op) => op.source === "open-api"));
  // Simulate restart between ledger commit and response receipt persistence.
  const db = new DatabaseSync(f.databasePath);
  db.prepare("DELETE FROM open_requests WHERE token_id=?").run(f.token.id);
  db.close();
  assert.deepEqual(
    await (await f.call("/records", { method: "POST", body })).json(),
    result,
  );
  assert.equal((await (await f.call("/records")).json()).total, 1);
});
test("tokens cannot access another book's attachments; upload replay and AI confirmation do not duplicate", async (context) => {
  const f = await fixture(context);
  const upload = await f.call("/attachments", {
    method: "POST",
    body: image,
    key: "synthetic-attachment",
  });
  assert.equal(upload.status, 201);
  const file = await upload.json();
  assert.equal(
    (await (await f.call(`/attachments/${file.id}`)).json()).base64,
    image.base64,
  );
  assert.deepEqual(
    await (
      await f.call("/attachments", {
        method: "POST",
        body: image,
        key: "synthetic-attachment",
      })
    ).json(),
    file,
  );
  const other = await book(f, f.cookie);
  const foreign = await (
    await f.request(path(other, "/attachments"), {
      cookie: f.cookie,
      method: "POST",
      body: image,
    })
  ).json();
  assert.equal((await f.call(`/attachments/${foreign.id}`)).status, 404);
  const recognition = await f.call("/ai/recognize", {
    method: "POST",
    key: "synthetic-open-ai",
    body: {
      revision: f.ledger.revision,
      text: "虚拟现金 餐饮 12.50元；虚拟现金 交通 6元",
    },
  });
  assert.equal(recognition.status, 200, await recognition.clone().text());
  const drafts = await recognition.json();
  assert.equal(drafts.drafts.length, 2);
  const body = {
    revision: drafts.revision,
    draftId: drafts.drafts[0].id,
    entry,
  };
  const confirmed = await f.call("/ai/confirm", {
    method: "POST",
    key: "synthetic-confirm",
    body,
  });
  assert.equal(confirmed.status, 200, await confirmed.clone().text());
  const saved = await confirmed.json();
  assert.equal(saved.record.amount, 1250);
  assert.deepEqual(
    await (
      await f.call("/ai/confirm", {
        method: "POST",
        key: "synthetic-confirm",
        body,
      })
    ).json(),
    saved,
  );
  assert.equal((await (await f.call("/records")).json()).total, 1);
});
test("expiry, revocation, role changes, member removal and persisted rate limits take effect", async (context) => {
  let now = Date.now();
  const f = await fixture(context, { now: () => now });
  for (let i = 0; i < 60; i++)
    assert.equal((await f.call("/ping")).status, 200);
  const limited = await f.call("/ping");
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  now += 60000;
  assert.equal((await f.call("/ping")).status, 200);
  await f.request(path(f.ledger, `/tokens/${f.token.id}`), {
    cookie: f.cookie,
    method: "DELETE",
    body: {},
  });
  assert.equal((await f.call("/ping")).status, 401);
  const expiring = await f.mint(SCOPES, 1);
  now += 86400001;
  assert.equal((await f.call("/ping", { bearer: expiring.token })).status, 401);
  now -= 86400001;
  const live = await f.mint();
  const db = new DatabaseSync(f.databasePath);
  db.prepare("UPDATE book_members SET role='viewer' WHERE book_id=?").run(
    f.ledger.id,
  );
  assert.equal(
    (
      await f.call("/records", {
        bearer: live.token,
        method: "POST",
        body: { revision: f.ledger.revision, entry },
      })
    ).status,
    403,
  );
  db.prepare("DELETE FROM book_members WHERE book_id=?").run(f.ledger.id);
  assert.equal((await f.call("/ping", { bearer: live.token })).status, 404);
  db.close();
});
test("revocation during model processing rejects the write and recognize-only tokens cannot auto-post", async (context) => {
  let release, entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let hold = false;
  const f = await fixture(context, {
    modelTransport: async () => {
      if (hold) {
        entered();
        await held;
      }
      return {
        choices: [
          { message: { content: JSON.stringify({ entries: [candidate()] }) } },
        ],
      };
    },
  });
  await profile(f, f.cookie);
  await f.request(path(f.ledger, "/ai/options"), {
    cookie: f.cookie,
    method: "PUT",
    body: { autoPost: true },
  });
  const narrow = await f.mint(["ai:recognize"]);
  const draft = await f.call("/ai/recognize", {
    bearer: narrow.token,
    method: "POST",
    body: { revision: f.ledger.revision, text: "虚拟低权限" },
  });
  assert.equal(draft.status, 200);
  const recognized = await draft.json();
  assert.equal(recognized.drafts[0].state, "pending");
  assert.equal((await (await f.call("/records")).json()).total, 0);
  hold = true;
  const pending = f.call("/ai/recognize", {
    method: "POST",
    key: "synthetic-revoke-await",
    body: { revision: recognized.revision, text: "虚拟撤销期间" },
  });
  await started;
  await f.request(path(f.ledger, `/tokens/${f.token.id}`), {
    cookie: f.cookie,
    method: "DELETE",
    body: {},
  });
  release();
  assert.equal((await pending).status, 401);
  const latest = await (
    await f.request(path(f.ledger, ""), { cookie: f.cookie })
  ).json();
  assert.equal(latest.revision, recognized.revision);
});

test("membership APIs revoke issued tokens on role change and exit; viewers cannot mint write scopes", async (context) => {
  const f = await fixture(context),
    memberCookie = await register(f, "token.member");
  const invitation = await (
    await f.request(path(f.ledger, "/invites"), {
      cookie: f.cookie,
      method: "POST",
      body: { role: "member" },
    })
  ).json();
  assert.equal(
    (
      await f.request("/api/network/invites/accept", {
        cookie: memberCookie,
        method: "POST",
        body: { code: invitation.code },
      })
    ).status,
    200,
  );
  const mint = (scopes) =>
    f.request(path(f.ledger, "/tokens"), {
      cookie: memberCookie,
      method: "POST",
      body: { name: "虚拟成员令牌", scopes },
    });
  const writerResponse = await mint(["records:write"]);
  assert.equal(writerResponse.status, 201);
  const writer = await writerResponse.json(),
    userId = f.sessions.get(memberCookie).user.id;
  assert.equal((await f.call("/ping", { bearer: writer.token })).status, 200);
  assert.equal(
    (
      await f.request(path(f.ledger, `/members/${userId}`), {
        cookie: f.cookie,
        method: "PUT",
        body: { role: "viewer" },
      })
    ).status,
    200,
  );
  assert.equal((await f.call("/ping", { bearer: writer.token })).status, 401);
  assert.equal((await mint(["records:write"])).status, 403);
  const readerResponse = await mint(["records:read"]);
  assert.equal(readerResponse.status, 201);
  const reader = await readerResponse.json();
  assert.equal(
    (await f.call("/records", { bearer: reader.token })).status,
    200,
  );
  assert.equal(
    (
      await f.request(path(f.ledger, `/members/${userId}`), {
        cookie: memberCookie,
        method: "DELETE",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal((await f.call("/ping", { bearer: reader.token })).status, 401);
});
