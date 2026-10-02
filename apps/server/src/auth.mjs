import {
  scrypt,
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { HttpError } from "./http.mjs";
const derive = promisify(scrypt);
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export function getSession(request, database) {
  const token = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("hamster_session="))
    ?.slice("hamster_session=".length);
  if (!token) return null;
  return (
    database
      .prepare(
        "SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
      )
      .get(tokenHash(token), Date.now()) ?? null
  );
}
export function requireSession(request, database) {
  const user = getSession(request, database);
  if (!user) throw new HttpError(401, "请先登录云端账号。");
  return user;
}
function cookie(token, isSecure, maxAge = SESSION_SECONDS) {
  return `hamster_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isSecure ? "; Secure" : ""}`;
}
export async function authenticate({ database, body, isRegister, isSecure }) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = body.password;
  if (
    !/^[a-z0-9][a-z0-9_.@-]{2,63}$/.test(username) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw new HttpError(
      400,
      "账号需为 3–64 位字母、数字或 . _ @ -，密码需为 12–256 位。",
    );
  let user = database
    .prepare("SELECT * FROM users WHERE username=?")
    .get(username);
  if (isRegister) {
    if (user) throw new HttpError(409, "此账号已存在。");
    const salt = randomBytes(16).toString("hex");
    const hash = await derive(password, salt, 64);
    user = { id: randomUUID(), username };
    try {
      database
        .prepare("INSERT INTO users VALUES(?,?,?,?)")
        .run(user.id, username, hash.toString("hex"), salt);
    } catch {
      throw new HttpError(409, "此账号已存在。");
    }
  } else {
    const salt = user?.salt ?? "0".repeat(32);
    const actual = await derive(password, salt, 64);
    const expected = Buffer.from(user?.password_hash ?? "0".repeat(128), "hex");
    if (!user || !timingSafeEqual(actual, expected))
      throw new HttpError(401, "账号或密码错误。");
  }
  const token = randomBytes(32).toString("base64url");
  database.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
  database
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(tokenHash(token), user.id, Date.now() + SESSION_SECONDS * 1000);
  return {
    user: { id: user.id, username: user.username },
    cookie: cookie(token, isSecure),
  };
}
export function logout(request, database, isSecure) {
  const token = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("hamster_session="))
    ?.slice("hamster_session=".length);
  if (token)
    database
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(tokenHash(token));
  return cookie("", isSecure, 0);
}
