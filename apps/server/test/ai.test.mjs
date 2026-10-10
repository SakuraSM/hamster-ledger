import test from "node:test";
import assert from "node:assert/strict";
import { setup, register } from "./helpers.mjs";
import { HttpError } from "../src/http.mjs";
import {
  entry,
  image,
  path,
  book,
  profile,
  recognition,
} from "./ai-fixtures.mjs";
test("no model parses multiple local text drafts and explicitly rejects images", async (context) => {
  const client = await setup(context),
    cookie = await register(client),
    ledger = await book(client, cookie);
  const response = await client.request(path(ledger, "/ai/recognize"), {
    cookie,
    method: "POST",
    body: recognition(ledger, {
      text: "虚拟现金 餐饮 12.50元；虚拟现金 交通 8元",
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.drafts.length, 2);
  assert.equal(result.ledger.records.length, 0);
  assert.equal(result.drafts[0].source, "text-rule");
  const upload = await client.request(path(ledger, "/attachments"), {
    cookie,
    method: "POST",
    body: image,
  });
  assert.equal(upload.status, 201);
  const attachment = await upload.json();
  const unavailable = await client.request(path(ledger, "/ai/recognize"), {
    cookie,
    method: "POST",
    body: recognition(result, { attachmentIds: [attachment.id] }),
  });
  assert.equal(unavailable.status, 400);
  assert.match((await unavailable.json()).error, /图片识别不可用/);
});
test("only complete ordinary entries auto-post; retries and undo cannot charge again", async (context) => {
  let calls = 0;
  const client = await setup(context, {
      modelTransport: async () => {
        calls++;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  entries: [
                    entry(),
                    entry({ amount: "-1" }),
                    entry({ accountId: "unknown", merchant: "未知账户" }),
                    entry({ type: "transfer" }),
                  ],
                }),
              },
            },
          ],
        };
      },
    }),
    cookie = await register(client),
    ledger = await book(client, cookie);
  await profile(client, cookie);
  assert.equal(
    (
      await client.request(path(ledger, "/ai/options"), {
        cookie,
        method: "PUT",
        body: { autoPost: true },
      })
    ).status,
    200,
  );
  const recognize = () =>
    client.request(path(ledger, "/ai/recognize"), {
      cookie,
      method: "POST",
      body: recognition(ledger),
    });
  const response = await recognize();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ledger.records.length, 1);
  assert.equal(result.drafts.filter((d) => d.state === "pending").length, 3);
  assert.equal((await recognize()).status, 200);
  assert.equal(calls, 1);
  const undo = await client.request(path(ledger, "/operations"), {
    cookie,
    method: "POST",
    body: {
      key: "synthetic-ai-undo",
      revision: result.revision,
      undoId: result.operationId,
    },
  });
  assert.equal(undo.status, 200);
  const undone = await undo.json();
  assert.equal(undone.ledger.records[0].isDeleted, true);
  assert.equal(undone.ledger.aiDrafts[0].state, "discarded");
  const replay = await (await recognize()).json();
  assert.equal(calls, 1);
  assert.equal(
    replay.ledger.records.filter((record) => !record.isDeleted).length,
    0,
  );
});
test("image destination, vision capability, duplicate screenshot and attachment access are checked", async (context) => {
  let calls = 0;
  const client = await setup(context, {
      modelTransport: async (args) => {
        calls++;
        assert.match(
          args.body.messages[1].content[1].image_url.url,
          /^data:image\/png;base64,/,
        );
        return {
          choices: [
            { message: { content: JSON.stringify({ entries: [entry()] }) } },
          ],
        };
      },
    }),
    cookie = await register(client),
    stranger = await register(client, "other.user"),
    ledger = await book(client, cookie),
    other = await book(client, stranger);
  const upload = await (
    await client.request(path(ledger, "/attachments"), {
      cookie,
      method: "POST",
      body: image,
    })
  ).json();
  assert.equal(
    (
      await client.request(path(ledger, `/attachments/${upload.id}`), {
        cookie: stranger,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await client.request(path(other, `/attachments/${upload.id}`), {
        cookie: stranger,
      })
    ).status,
    404,
  );
  await profile(client, cookie);
  const body = recognition(ledger, {
    attachmentIds: [upload.id],
    targetEndpoint: "https://model.example/v1",
  });
  assert.equal(
    (
      await client.request(path(ledger, "/ai/recognize"), {
        cookie,
        method: "POST",
        body,
      })
    ).status,
    400,
  );
  assert.equal(calls, 0);
  await profile(client, cookie, { vision: true });
  assert.equal(
    (
      await client.request(path(ledger, "/ai/recognize"), {
        cookie,
        method: "POST",
        body: { ...body, targetEndpoint: "https://wrong.example/v1" },
      })
    ).status,
    409,
  );
  const recognized = await client.request(path(ledger, "/ai/recognize"), {
    cookie,
    method: "POST",
    body,
  });
  assert.equal(recognized.status, 200);
  assert.equal(
    (
      await client.request(path(ledger, "/ai/recognize"), {
        cookie,
        method: "POST",
        body: { ...body, key: "another-key-for-same-image" },
      })
    ).status,
    200,
  );
  assert.equal(calls, 1);
  assert.equal(
    (
      await client.request(path(ledger, `/attachments/${upload.id}`), {
        cookie,
        method: "DELETE",
        body: {},
      })
    ).status,
    409,
  );
});
test("model failures do not create drafts or mutate the book", async (context) => {
  let status = 504;
  const client = await setup(context, {
      modelTransport: async () => {
        throw new HttpError(status, "虚拟模型故障");
      },
    }),
    cookie = await register(client),
    ledger = await book(client, cookie);
  await profile(client, cookie);
  for (status of [504, 429, 502])
    assert.equal(
      (
        await client.request(path(ledger, "/ai/recognize"), {
          cookie,
          method: "POST",
          body: recognition(ledger),
        })
      ).status,
      status,
    );
  const latest = await (
    await client.request(path(ledger, ""), { cookie })
  ).json();
  assert.equal(latest.revision, ledger.revision);
  assert.equal(latest.ledger.aiDrafts, undefined);
});
