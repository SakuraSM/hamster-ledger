import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
const image = process.env.HAMSTER_TEST_IMAGE ?? "hamster-ledger:parity-arm64";
const prefix = `hamster-test-${randomUUID().slice(0, 8)}`;
const containers = [prefix + "-primary", prefix + "-restored"];
const databaseContainers = [prefix + "-pg", prefix + "-pg-restored"];
const network = prefix + "-network";
const volumes = [prefix + "-data", prefix + "-copy", prefix + "-backup"];
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1X8AAAAASUVORK5CYII=";
const origin = "http://127.0.0.1:4180";
async function launchDatabase(name) {
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    "-e",
    "POSTGRES_PASSWORD=synthetic-admin-only",
    "-e",
    "POSTGRES_DB=hamster",
    "-e",
    "LEDGER_DB_PASSWORD=synthetic-app-only",
    "-v",
    new URL("../deploy/postgres/init-app.sh", import.meta.url).pathname +
      ":/docker-entrypoint-initdb.d/10-app.sh:ro",
    "postgres:18.6-bookworm",
  );
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      docker(
        "exec",
        name,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "hamster",
      );
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("PostgreSQL container did not become healthy.");
}
async function launch(name, volume, databaseHost = databaseContainers[0]) {
  const databaseUrl = `postgresql://hamster:synthetic-app-only@${databaseHost}:5432/hamster`;
  docker(
    "run",
    "--rm",
    "--network",
    network,
    "-e",
    `DATABASE_URL=${databaseUrl}`,
    image,
    "node",
    "apps/server/src/migrate.mjs",
  );
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    "-e",
    `DATABASE_URL=${databaseUrl}`,
    "-p",
    "127.0.0.1::4180",
    "-e",
    `PUBLIC_ORIGIN=${origin}`,
    "-v",
    `${volume}:/data`,
    "--health-interval=1s",
    "--health-start-period=1s",
    image,
  );
  return await waitHealthy(name);
}
async function waitHealthy(name) {
  const ports = JSON.parse(
    docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", name),
  );
  const url = `http://127.0.0.1:${ports["4180/tcp"][0].HostPort}`;
  for (let i = 0; i < 60; i++) {
    const status = docker(
      "inspect",
      "--format",
      "{{.State.Health.Status}}",
      name,
    );
    if (status === "healthy") return url;
    if (status === "unhealthy")
      throw new Error(
        `Container became unhealthy: ${docker("logs", name)} ${docker("inspect", "--format", "{{json .State.Health.Log}}", name)}`,
      );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Container did not become healthy.");
}
let cookie, auth, token;
async function request(url, path, method = "GET", body, open = false, key) {
  const response = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(open
        ? {
            Authorization: `Bearer ${token}`,
            ...(key ? { "Idempotency-Key": key } : {}),
          }
        : {
            Origin: origin,
            "X-Hamster-Client": "1",
            ...(cookie
              ? {
                  Cookie: cookie,
                  "X-Hamster-User": auth.user.id,
                  "X-CSRF-Token": auth.csrfToken,
                }
              : {}),
          }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${result.error ?? ""}`);
  if (response.headers.get("set-cookie")) {
    cookie = response.headers.get("set-cookie").split(";")[0];
    auth = result;
  }
  return result;
}
try {
  docker("network", "create", network);
  await launchDatabase(databaseContainers[0]);
  for (const volume of volumes) docker("volume", "create", volume);
  const url = await launch(containers[0], volumes[0]);
  await request(url, "/api/auth/register", "POST", {
    username: "container.synthetic",
    password: "synthetic-container-password-2026",
  });
  const book = await request(url, "/api/network/books", "POST", {
    name: "虚拟容器恢复账本",
    confirm: true,
    ledger: {
      version: 1,
      records: [],
      reviews: [],
      rules: {},
      files: [],
      accounts: [
        {
          id: "cash",
          name: "虚拟现金",
          kind: "asset",
          type: "现金",
          openingBalance: 10000,
          balanceAt: "2026-01-01 00:00:00",
        },
      ],
    },
  });
  token = (
    await request(url, `/api/network/books/${book.id}/tokens`, "POST", {
      name: "虚拟恢复验证",
      scopes: [
        "records:read",
        "records:write",
        "attachments:read",
        "attachments:write",
      ],
    })
  ).token;
  await request(url, "/api/models/profile", "PUT", {
    endpoint: "https://model.example/v1",
    model: "synthetic-model",
    key: "synthetic-container-model-secret",
    vision: false,
    noKey: false,
    allowLan: false,
  });
  const attachment = await request(
    url,
    "/api/open/v1/attachments",
    "POST",
    { name: "虚拟凭证.png", mime: "image/png", base64: png },
    true,
    "container-upload-key",
  );
  const body = {
    revision: book.revision,
    entry: {
      date: "2026-10-03 12:00:00",
      merchant: "虚拟容器商户",
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
        attachmentIds: [attachment.id],
      },
    },
  };
  const record = await request(
    url,
    "/api/open/v1/records",
    "POST",
    body,
    true,
    "container-create-key",
  );
  const keyHash = docker(
    "exec",
    containers[0],
    "sha256sum",
    "/data/.model-key",
  ).split(" ")[0];
  async function verify(target) {
    const records = await request(
      target,
      "/api/open/v1/records",
      "GET",
      undefined,
      true,
    );
    assert.equal(records.total, 1);
    assert.equal(records.records[0].amount, 1250);
    assert.deepEqual(
      await request(
        target,
        "/api/open/v1/records",
        "POST",
        body,
        true,
        "container-create-key",
      ),
      record,
    );
    const file = await request(
      target,
      `/api/open/v1/attachments/${attachment.id}`,
      "GET",
      undefined,
      true,
    );
    assert.equal(file.base64, png);
    assert.equal(
      file.hash,
      createHash("sha256").update(Buffer.from(png, "base64")).digest("hex"),
    );
    assert.equal((await request(target, "/api/models/profile")).hasKey, true);
  }
  docker("restart", containers[0]);
  await verify(await waitHealthy(containers[0]));
  docker("stop", containers[0]);
  docker(
    "run",
    "--rm",
    "--user",
    "0",
    "--entrypoint",
    "sh",
    "-v",
    `${volumes[0]}:/data:ro`,
    "-v",
    `${volumes[2]}:/backup`,
    image,
    "-c",
    "tar -C /data -czf /backup/ledger.tar.gz .",
  );
  docker(
    "run",
    "--rm",
    "--user",
    "0",
    "--entrypoint",
    "sh",
    "-v",
    `${volumes[1]}:/data`,
    "-v",
    `${volumes[2]}:/backup:ro`,
    image,
    "-c",
    "tar -C /data -xzf /backup/ledger.tar.gz && chown -R 1000:1000 /data",
  );
  const dump = execFileSync(
    "docker",
    [
      "exec",
      databaseContainers[0],
      "pg_dump",
      "-Fc",
      "--no-owner",
      "--no-privileges",
      "-U",
      "postgres",
      "-d",
      "hamster",
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  await launchDatabase(databaseContainers[1]);
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      databaseContainers[1],
      "pg_restore",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--role=hamster",
      "-U",
      "postgres",
      "-d",
      "hamster",
    ],
    { input: dump, maxBuffer: 16 * 1024 * 1024 },
  );
  const restored = await launch(
    containers[1],
    volumes[1],
    databaseContainers[1],
  );
  await verify(restored);
  assert.equal(
    docker("exec", containers[1], "sha256sum", "/data/.model-key").split(
      " ",
    )[0],
    keyHash,
  );
  console.log(
    JSON.stringify({
      image,
      architecture: docker(
        "image",
        "inspect",
        "--format",
        "{{.Architecture}}",
        image,
      ),
      health: "passed",
      restart: "passed",
      isolatedVolumeRestore: "passed",
      postgresDumpRestore: "passed",
      records: 1,
      attachments: 1,
      tokenAndIdempotency: "preserved",
      modelMasterKey: "preserved",
    }),
  );
} finally {
  for (const name of [...containers, ...databaseContainers]) {
    try {
      docker("rm", "-fv", name);
    } catch {
      /* A failed startup may not have created this container. */
    }
  }
  try {
    docker("network", "rm", network);
  } catch {}
  for (const volume of volumes) {
    try {
      docker("volume", "rm", volume);
    } catch {
      /* Keep an unexpectedly busy volume for diagnosis. */
    }
  }
}
