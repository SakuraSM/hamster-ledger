import { createAuthLimiter } from "./auth-limiter.mjs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDatabase } from "./database.mjs";
import { createPassword, normalizeUsername } from "./passwords.mjs";
export async function resetAccountPassword({ database, username }) {
  const user = database
    .prepare("SELECT id,credential_version FROM users WHERE username=?")
    .get(normalizeUsername(username));
  if (!user) throw new Error("账号不存在。");
  const temporaryPassword = randomBytes(24).toString("base64url");
  const password = await createPassword(temporaryPassword);
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = database
      .prepare(
        "UPDATE users SET password_hash=?,salt=?,password_version=2,must_change_password=1,credential_version=credential_version+1 WHERE id=? AND credential_version=?",
      )
      .run(
        password.passwordHash,
        password.salt,
        user.id,
        user.credential_version,
      );
    if (result.changes !== 1) throw new Error("账号凭据已变化，请重试。");
    database.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
    createAuthLimiter(database).resetAccount(normalizeUsername(username));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { temporaryPassword };
}
async function main() {
  const args = process.argv.slice(2);
  const position = args.indexOf("--username");
  if (position < 0 || !args[position + 1] || args.length !== 2)
    throw new Error("用法：npm run auth:reset -- --username 账号名");
  const root = resolve(import.meta.dirname, "../../..");
  const database = openDatabase(
    process.env.DATABASE_PATH ?? resolve(root, "data/ledger.sqlite"),
  );
  try {
    const result = await resetAccountPassword({
      database,
      username: args[position + 1],
    });
    console.log("密码已重置，所有旧会话已撤销。临时密码只显示在当前终端：");
    console.log(result.temporaryPassword);
    console.log("账号持有人需要使用临时密码登录并设置新密码。");
  } finally {
    database.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
