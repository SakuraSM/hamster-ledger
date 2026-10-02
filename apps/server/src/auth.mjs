import { randomUUID } from "node:crypto";
import { AUTH_POLICY, AUTH_FAILURE, publicAuthPolicy } from "./auth-policy.mjs";
import {
  createPassword,
  verifyPassword,
  normalizeUsername,
  isValidUsername,
  isLoginPassword,
  validateNewPassword,
} from "./passwords.mjs";
import { createAuthLimiter } from "./auth-limiter.mjs";
import {
  getSession,
  requireSession,
  createSession,
  sessionResponse,
  logout,
  listSessions,
  clearSessionCookie,
} from "./sessions.mjs";
import { HttpError, json, readJson } from "./http.mjs";
function transaction(database, operation) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
function account(database, username) {
  return database.prepare("SELECT * FROM users WHERE username=?").get(username);
}
function assertCurrentPassword(database, user) {
  const current = database
    .prepare("SELECT * FROM users WHERE id=?")
    .get(user.id);
  if (
    !current ||
    current.credential_version !== user.credential_version ||
    current.password_hash !== user.password_hash
  )
    throw new HttpError(401, AUTH_FAILURE, "invalid_credentials");
  return current;
}
export function createAuthApi({ database, allowRegistration, now = Date.now }) {
  const limiter = createAuthLimiter(database, now);
  async function verifyCurrent(request, body, { allowTemporary = false } = {}) {
    const session = requireSession(request, database, {
      write: true,
      now: now(),
      allowTemporary,
    });
    limiter.ip(request);
    limiter.account(session.username);
    const user = account(database, session.username);
    if (
      !isLoginPassword(body.currentPassword) ||
      !(await verifyPassword(body.currentPassword, user))
    )
      throw new HttpError(401, "当前密码不正确。", "invalid_credentials");
    assertCurrentPassword(database, user);
    requireSession(request, database, {
      write: true,
      now: now(),
      allowTemporary,
    });
    limiter.resetAccount(user.username);
    return { session, user };
  }
  return async (request, response, { path, isSecure }) => {
    const method = request.method;
    if (path === "/api/auth/me" && method === "GET") {
      const session = getSession(request, database, now());
      json(response, 200, {
        ...(session
          ? sessionResponse(session)
          : { user: null, csrfToken: null, session: null }),
        policy: publicAuthPolicy(allowRegistration),
      });
      return true;
    }
    if (
      ["/api/auth/register", "/api/auth/login"].includes(path) &&
      method === "POST"
    ) {
      limiter.ip(request);
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      const username = normalizeUsername(body.username);
      const isRegister = path.endsWith("register");
      if (isRegister && !allowRegistration)
        throw new HttpError(
          403,
          "此服务已关闭注册，请联系服务管理员。",
          "registration_closed",
        );
      if (!isValidUsername(username) || !isLoginPassword(body.password))
        throw new HttpError(
          isRegister ? 400 : 401,
          isRegister
            ? "账号需为 3–64 位字母、数字或 . _ @ -，请填写有效密码。"
            : AUTH_FAILURE,
          "invalid_credentials",
        );
      limiter.account(username);
      const existing = account(database, username);
      let user;
      if (isRegister) {
        limiter.registration(request);
        const password = await createPassword(body.password);
        user = transaction(database, () => {
          if (account(database, username))
            throw new HttpError(
              409,
              "此账号不可用，请更换账号或尝试登录。",
              "account_unavailable",
            );
          const created = { id: randomUUID(), username, credential_version: 1 };
          database
            .prepare(
              "INSERT INTO users(id,username,password_hash,salt,password_version,credential_version) VALUES(?,?,?,?,?,1)",
            )
            .run(
              created.id,
              username,
              password.passwordHash,
              password.salt,
              password.passwordVersion,
            );
          return created;
        });
      } else {
        if (!(await verifyPassword(body.password, existing)))
          throw new HttpError(401, AUTH_FAILURE, "invalid_credentials");
        user = assertCurrentPassword(database, existing);
        if (existing.password_version !== 2) {
          const password = await createPasswordForLegacy(body.password);
          user = transaction(database, () => {
            const current = assertCurrentPassword(database, existing);
            database
              .prepare(
                "UPDATE users SET password_hash=?,salt=?,password_version=2 WHERE id=?",
              )
              .run(password.passwordHash, password.salt, current.id);
            return {
              ...current,
              password_hash: password.passwordHash,
              salt: password.salt,
              password_version: 2,
            };
          });
        }
      }
      const result = transaction(database, () => {
        const current = database
          .prepare("SELECT * FROM users WHERE id=?")
          .get(user.id);
        if (current.credential_version !== user.credential_version)
          throw new HttpError(401, AUTH_FAILURE, "invalid_credentials");
        return createSession({
          request,
          database,
          user: current,
          isSecure,
          remember: body.remember === true,
          now: now(),
        });
      });
      limiter.resetAccount(username);
      json(
        response,
        isRegister ? 201 : 200,
        { ...result.body, policy: publicAuthPolicy(allowRegistration) },
        { "Set-Cookie": result.cookie },
      );
      return true;
    }
    if (path === "/api/auth/logout" && method === "POST") {
      if (getSession(request, database, now()))
        requireSession(request, database, {
          write: true,
          now: now(),
          allowTemporary: true,
        });
      json(
        response,
        200,
        { ok: true },
        { "Set-Cookie": logout(request, database, isSecure) },
      );
      return true;
    }
    if (path === "/api/auth/activity" && method === "POST") {
      const session = requireSession(request, database, {
        write: true,
        now: now(),
      });
      database
        .prepare("UPDATE sessions SET last_seen_at=? WHERE id=?")
        .run(now(), session.id);
      json(response, 200, { ok: true });
      return true;
    }
    if (path === "/api/auth/sessions" && method === "GET") {
      const session = requireSession(request, database, { now: now() });
      json(response, 200, { sessions: listSessions(database, session, now()) });
      return true;
    }
    if (path === "/api/auth/password" && method === "POST") {
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      validateNewPassword(body.newPassword);
      const { session, user } = await verifyCurrent(request, body, {
        allowTemporary: true,
      });
      if (body.newPassword === body.currentPassword)
        throw new HttpError(400, "新密码需要与当前密码不同。", "same_password");
      const password = await createPassword(body.newPassword);
      const result = transaction(database, () => {
        assertCurrentPassword(database, user);
        requireSession(request, database, {
          write: true,
          now: now(),
          allowTemporary: true,
        });
        database
          .prepare(
            "UPDATE users SET password_hash=?,salt=?,password_version=2,must_change_password=0,credential_version=credential_version+1 WHERE id=?",
          )
          .run(password.passwordHash, password.salt, user.id);
        database.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
        return createSession({
          request,
          database,
          user: {
            ...user,
            must_change_password: 0,
            credential_version: user.credential_version + 1,
          },
          isSecure,
          remember: Boolean(session.remember),
          now: now(),
        });
      });
      json(response, 200, result.body, { "Set-Cookie": result.cookie });
      return true;
    }
    if (path === "/api/auth/logout-others" && method === "POST") {
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      const { session } = await verifyCurrent(request, body);
      const result = database
        .prepare("DELETE FROM sessions WHERE user_id=? AND id<>?")
        .run(session.user_id, session.id);
      json(response, 200, { ok: true, revoked: result.changes });
      return true;
    }
    const match = path.match(/^\/api\/auth\/sessions\/([a-z0-9-]+)$/);
    if (match && method === "DELETE") {
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      const { session } = await verifyCurrent(request, body);
      const result = database
        .prepare("DELETE FROM sessions WHERE id=? AND user_id=?")
        .run(match[1], session.user_id);
      if (!result.changes)
        throw new HttpError(404, "该会话已失效。", "session_not_found");
      json(
        response,
        200,
        { ok: true, isCurrent: match[1] === session.id },
        match[1] === session.id
          ? { "Set-Cookie": clearSessionCookie(isSecure) }
          : {},
      );
      return true;
    }
    return false;
  };
}
// Legacy passwords are verified unchanged; upgrading their work factor must not apply new enrollment rules.
async function createPasswordForLegacy(password) {
  return createPassword(password, { validate: false });
}
