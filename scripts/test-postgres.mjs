import { execFileSync, spawn } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
const root = resolve(import.meta.dirname, "..");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let container,
  url = process.env.TEST_DATABASE_URL;
try {
  if (!url) {
    container = "hamster-pg-test-" + randomUUID().slice(0, 8);
    const password = randomBytes(24).toString("hex");
    docker(
      "run",
      "-d",
      "--name",
      container,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      "POSTGRES_DB=hamster_test",
      "-p",
      "127.0.0.1::5432",
      "postgres:18.6-bookworm",
    );
    const ports = JSON.parse(
      docker(
        "inspect",
        "--format",
        "{{json .NetworkSettings.Ports}}",
        container,
      ),
    );
    url = `postgresql://postgres:${password}@127.0.0.1:${ports["5432/tcp"][0].HostPort}/hamster_test`;
    console.log("使用隔离 PostgreSQL 18 测试实例。");
  }
  let connected = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const pool = new pg.Pool({
      connectionString: url,
      connectionTimeoutMillis: 500,
      max: 1,
    });
    try {
      await pool.query("SELECT 1");
      connected = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    } finally {
      await pool.end();
    }
  }
  if (!connected) throw new Error("测试 PostgreSQL 未就绪。");
  const files =
    process.argv.length > 2
      ? process.argv.slice(2)
      : (await readdir(resolve(root, "apps/server/test")))
          .filter((name) => name.endsWith(".test.mjs"))
          .map((name) => "apps/server/test/" + name);
  process.exitCode = await new Promise((done, reject) => {
    const child = spawn(
      process.execPath,
      ["--test", "--test-concurrency=4", ...files],
      {
        cwd: root,
        env: { ...process.env, TEST_DATABASE_URL: url },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => done(code ?? 1));
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (container) docker("rm", "-fv", container);
}
