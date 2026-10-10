import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setup, register } from "./helpers.mjs";
import { profile } from "./ai-fixtures.mjs";
import { modelSecrets } from "../src/model-secrets.mjs";
import { allowedModelAddress, requestModel } from "../src/model-transport.mjs";
test("keys are encrypted, stay opaque, survive reopening and cannot move silently to a new endpoint", async (context) => {
  const client = await setup(context),
    cookie = await register(client);
  const result = await profile(client, cookie);
  assert.equal(result.hasKey, true);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  const db = new DatabaseSync(client.databasePath, { readOnly: true });
  const row = db.prepare("SELECT * FROM model_profiles").get();
  db.close();
  assert.equal(row.secret.includes("synthetic-secret"), false);
  assert.equal(
    modelSecrets(client.databasePath).open(row.user_id, row.secret),
    "synthetic-secret-not-real",
  );
  assert.equal(
    (await stat(join(dirname(client.databasePath), ".model-key"))).mode & 0o777,
    0o600,
  );
  assert.equal(
    (await readFile(client.databasePath)).includes(
      Buffer.from("synthetic-secret-not-real"),
    ),
    false,
  );
  const changed = await client.request("/api/models/profile", {
    cookie,
    method: "PUT",
    body: { endpoint: "https://different.example/v1", model: "other", key: "" },
  });
  assert.equal(changed.status, 400);
  const missing = await profile(client, cookie, {
    clearKey: true,
    key: undefined,
  });
  assert.equal(missing.hasKey, false);
  assert.equal(
    (
      await client.request("/api/models/test", {
        cookie,
        method: "POST",
        body: { vision: false },
      })
    ).status,
    400,
  );
});
test("SSRF policy requires explicit LAN access and always blocks metadata endpoints", async () => {
  for (const address of ["127.0.0.1", "192.168.2.3", "::1", "::ffff:7f00:1"]) {
    assert.equal(allowedModelAddress(address, false), false);
    assert.equal(allowedModelAddress(address, true), true);
  }
  for (const address of [
    "169.254.169.254",
    "100.100.100.200",
    "fe80::1",
    "::ffff:169.254.169.254",
  ])
    assert.equal(allowedModelAddress(address, true), false);
  await assert.rejects(
    requestModel({
      config: { endpoint: "http://127.0.0.1:1", allowLan: false },
      key: "",
      path: "/models",
    }),
    /HTTPS/,
  );
});

test("capability tests validate the returned answer and list model IDs", async (context) => {
  let canSee = true;
  const client = await setup(context, {
      modelTransport: async ({ path, body }) =>
        path === "/models"
          ? { data: [{ id: "synthetic-vision" }] }
          : {
              choices: [
                {
                  message: {
                    content: Array.isArray(body.messages[0].content)
                      ? canSee
                        ? "red"
                        : "cannot see"
                      : "OK",
                  },
                },
              ],
            },
    }),
    cookie = await register(client);
  await profile(client, cookie, { vision: true, model: "" });
  assert.deepEqual(
    (await (await client.request("/api/models/list", { cookie })).json())
      .models,
    ["synthetic-vision"],
  );
  assert.equal(
    (
      await client.request("/api/models/test", {
        cookie,
        method: "POST",
        body: { vision: false },
      })
    ).status,
    400,
  );
  await profile(client, cookie, { vision: true });
  for (const vision of [false, true])
    assert.equal(
      (
        await client.request("/api/models/test", {
          cookie,
          method: "POST",
          body: { vision },
        })
      ).status,
      200,
    );
  canSee = false;
  assert.equal(
    (
      await client.request("/api/models/test", {
        cookie,
        method: "POST",
        body: { vision: true },
      })
    ).status,
    422,
  );
});
