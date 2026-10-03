import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { AUTH_POLICY } from "./auth-policy.mjs";
import { HttpError } from "./http.mjs";
const COOKIE_NAME = "hamster_session";
const cookieName = (isSecure) =>
  isSecure ? "__Host-hamster_session" : COOKIE_NAME;
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
export function sessionToken(request) {
  if (request.authTransport === "native") {
    const authorization = request.headers.authorization;
    return typeof authorization === "string" &&
      /^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)
      ? authorization.slice(7)
      : null;
  }
  const name = request.authCookieName ?? COOKIE_NAME;
  return (
    request.headers.cookie
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(name + "="))
      ?.slice(name.length + 1) ?? null
  );
}
export function clearSessionCookie(isSecure) {
  return `${cookieName(isSecure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isSecure ? "; Secure" : ""}`;
}
function cookie(token, isSecure, remember) {
  return `${cookieName(isSecure)}=${token}; Path=/; HttpOnly; SameSite=Strict${remember ? `; Max-Age=${AUTH_POLICY.rememberSeconds}` : ""}${isSecure ? "; Secure" : ""}`;
}
function deviceName(value = "") {
  if (/Android/i.test(value)) return "Android 浏览器";
  if (/iPhone|iPad/i.test(value)) return "iOS 浏览器";
  if (/Edg\//.test(value)) return "Edge";
  if (/Firefox\//.test(value)) return "Firefox";
  if (/Chrome\//.test(value)) return "Chrome";
  if (/Safari\//.test(value)) return "Safari";
  return "其他客户端";
}
export function getSession(request, database, now = Date.now()) {
  const token = sessionToken(request);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = database
    .prepare(
      "SELECT sessions.*,users.username,users.must_change_password,users.credential_version AS current_version FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=?",
    )
    .get(tokenHash(token));
  if (!session || session.transport !== (request.authTransport ?? "cookie"))
    return null;
  if (
    session.expires_at <= now ||
    session.last_seen_at + session.idle_seconds * 1000 <= now ||
    session.credential_version !== session.current_version
  ) {
    database
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(session.token_hash);
    return null;
  }
  return session;
}
export function requireSession(request, database, options = {}) {
  const session = getSession(request, database, options.now);
  if (!session)
    throw new HttpError(
      401,
      "登录已失效，请重新登录；本机账单已保留。",
      "session_expired",
    );
  if (session.must_change_password && !options.allowTemporary)
    throw new HttpError(
      403,
      "请先设置新的登录密码。",
      "password_change_required",
    );
  const expected = request.headers["x-hamster-user"];
  if (
    (options.write && !expected) ||
    (expected && expected !== session.user_id)
  )
    throw new HttpError(
      401,
      "登录账号已在其他页面变更，请重新确认账号。",
      "account_changed",
    );
  if (options.write) {
    const csrf = request.headers["x-csrf-token"];
    const actual = Buffer.from(typeof csrf === "string" ? csrf : "");
    const required = Buffer.from(session.csrf_token);
    if (actual.length !== required.length || !timingSafeEqual(actual, required))
      throw new HttpError(
        403,
        "登录状态需要刷新，请重新登录后重试。",
        "csrf_invalid",
      );
    database
      .prepare("UPDATE sessions SET last_seen_at=? WHERE id=?")
      .run(options.now ?? Date.now(), session.id);
  }
  return session;
}
export function sessionResponse(session) {
  return {
    user: {
      id: session.user_id,
      username: session.username,
      mustChangePassword: Boolean(session.must_change_password),
    },
    csrfToken: session.csrf_token,
    session: {
      id: session.id,
      expiresAt: session.expires_at,
      remember: Boolean(session.remember),
    },
  };
}
export function createSession({
  request,
  database,
  user,
  isSecure,
  remember = false,
  now = Date.now(),
}) {
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const csrfToken = randomBytes(32).toString("base64url");
  const seconds = remember
    ? AUTH_POLICY.rememberSeconds
    : AUTH_POLICY.sessionSeconds;
  const idleSeconds = remember
    ? AUTH_POLICY.rememberIdleSeconds
    : AUTH_POLICY.sessionIdleSeconds;
  database
    .prepare(
      "DELETE FROM sessions WHERE expires_at<=? OR last_seen_at+idle_seconds*1000<=?",
    )
    .run(now, now);
  const previous = sessionToken(request);
  if (previous)
    database
      .prepare("DELETE FROM sessions WHERE token_hash=? AND transport=?")
      .run(tokenHash(previous), request.authTransport ?? "cookie");
  database
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at,id,created_at,last_seen_at,idle_seconds,remember,csrf_token,credential_version,device_name,transport) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      tokenHash(token),
      user.id,
      now + seconds * 1000,
      id,
      now,
      now,
      idleSeconds,
      remember ? 1 : 0,
      csrfToken,
      user.credential_version,
      request.authTransport === "native"
        ? "Android 应用"
        : deviceName(request.headers["user-agent"]),
      request.authTransport ?? "cookie",
    );
  database
    .prepare(
      "DELETE FROM sessions WHERE user_id=? AND id NOT IN (SELECT id FROM sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?)",
    )
    .run(user.id, user.id, AUTH_POLICY.maximumSessions);
  return {
    body: {
      ...(request.authTransport === "native" ? { accessToken: token } : {}),
      user: {
        id: user.id,
        username: user.username,
        mustChangePassword: Boolean(user.must_change_password),
      },
      csrfToken,
      session: { id, expiresAt: now + seconds * 1000, remember },
    },
    cookie:
      request.authTransport === "native"
        ? null
        : cookie(token, isSecure, remember),
  };
}
export function logout(request, database, isSecure) {
  const token = sessionToken(request);
  if (token)
    database
      .prepare("DELETE FROM sessions WHERE token_hash=? AND transport=?")
      .run(tokenHash(token), request.authTransport ?? "cookie");
  return request.authTransport === "native"
    ? null
    : clearSessionCookie(isSecure);
}
export function listSessions(database, session, now = Date.now()) {
  return database
    .prepare(
      "SELECT id,created_at AS createdAt,last_seen_at AS lastSeenAt,expires_at AS expiresAt,remember,device_name AS deviceName FROM sessions WHERE user_id=? AND expires_at>? AND last_seen_at+idle_seconds*1000>? ORDER BY created_at DESC",
    )
    .all(session.user_id, now, now)
    .map((item) => ({
      ...item,
      remember: Boolean(item.remember),
      isCurrent: item.id === session.id,
    }));
}
