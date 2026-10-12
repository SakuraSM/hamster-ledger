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
async function transaction(database, operation) {
  return await database.transaction(operation);
}
async function account(database, username) {
  return await database
    .prepare("SELECT * FROM users WHERE username=$1")
    .get(username);
}
async function assertCurrentPassword(database, user) {
  const current = await database
    .prepare(
      "SELECT * FROM users WHERE id=$1" +
        (database.isInTransaction() ? " FOR UPDATE" : ""),
    )
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
    const session = await requireSession(request, database, {
      write: true,
      now: now(),
      allowTemporary,
    });
    await limiter.ip(request);
    await limiter.account(session.username);
    const user = await account(database, session.username);
    if (
      !isLoginPassword(body.currentPassword) ||
      !(await verifyPassword(body.currentPassword, user))
    )
      throw new HttpError(401, "当前密码不正确。", "invalid_credentials");
    await assertCurrentPassword(database, user);
    await requireSession(request, database, {
      write: true,
      now: now(),
      allowTemporary,
    });
    await limiter.resetAccount(user.username);
    return { session, user };
  }
  return async (request, response, { path, isSecure }) => {
    const method = request.method;
    if (path === "/api/auth/me" && method === "GET") {
      const session = await getSession(request, database, now());
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
      await limiter.ip(request);
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
      await limiter.account(username);
      const existing = await account(database, username);
      let user;
      if (isRegister) {
        await limiter.registration(request);
        const password = await createPassword(body.password);
        user = await transaction(database, async () => {
          if (await account(database, username))
            throw new HttpError(
              409,
              "此账号不可用，请更换账号或尝试登录。",
              "account_unavailable",
            );
          const created = { id: randomUUID(), username, credential_version: 1 };
          await database
            .prepare(
              "INSERT INTO users(id,username,password_hash,salt,password_version,credential_version) VALUES($1,$2,$3,$4,$5,1)",
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
        user = await assertCurrentPassword(database, existing);
        if (existing.password_version !== 2) {
          const password = await createPasswordForLegacy(body.password);
          user = await transaction(database, async () => {
            const current = await assertCurrentPassword(database, existing);
            await database
              .prepare(
                "UPDATE users SET password_hash=$1,salt=$2,password_version=2 WHERE id=$3",
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
      const result = await transaction(database, async () => {
        const current = await database
          .prepare(
            "SELECT * FROM users WHERE id=$1" +
              (database.isInTransaction() ? " FOR UPDATE" : ""),
          )
          .get(user.id);
        if (current.credential_version !== user.credential_version)
          throw new HttpError(401, AUTH_FAILURE, "invalid_credentials");
        return await createSession({
          request,
          database,
          user: current,
          isSecure,
          remember: body.remember === true,
          now: now(),
        });
      });
      await limiter.resetAccount(username);
      json(
        response,
        isRegister ? 201 : 200,
        { ...result.body, policy: publicAuthPolicy(allowRegistration) },
        result.cookie ? { "Set-Cookie": result.cookie } : {},
      );
      return true;
    }
    if (path === "/api/auth/logout" && method === "POST") {
      if (await getSession(request, database, now()))
        await requireSession(request, database, {
          write: true,
          now: now(),
          allowTemporary: true,
        });
      const cleared = await logout(request, database, isSecure);
      json(
        response,
        200,
        { ok: true },
        cleared ? { "Set-Cookie": cleared } : {},
      );
      return true;
    }
    if (path === "/api/auth/activity" && method === "POST") {
      const session = await requireSession(request, database, {
        write: true,
        now: now(),
      });
      await database
        .prepare("UPDATE sessions SET last_seen_at=$1 WHERE id=$2")
        .run(now(), session.id);
      json(response, 200, { ok: true });
      return true;
    }
    if (path === "/api/auth/sessions" && method === "GET") {
      const session = await requireSession(request, database, { now: now() });
      json(response, 200, {
        sessions: await listSessions(database, session, now()),
      });
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
      const result = await transaction(database, async () => {
        await assertCurrentPassword(database, user);
        await requireSession(request, database, {
          write: true,
          now: now(),
          allowTemporary: true,
        });
        await database
          .prepare(
            "UPDATE users SET password_hash=$1,salt=$2,password_version=2,must_change_password=FALSE,credential_version=credential_version+1 WHERE id=$3",
          )
          .run(password.passwordHash, password.salt, user.id);
        await database
          .prepare("DELETE FROM sessions WHERE user_id=$1")
          .run(user.id);
        return await createSession({
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
      json(
        response,
        200,
        result.body,
        result.cookie ? { "Set-Cookie": result.cookie } : {},
      );
      return true;
    }
    if (path === "/api/auth/logout-others" && method === "POST") {
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      const { session } = await verifyCurrent(request, body);
      const result = await database
        .prepare("DELETE FROM sessions WHERE user_id=$1 AND id<>$2")
        .run(session.user_id, session.id);
      json(response, 200, { ok: true, revoked: result.rowCount });
      return true;
    }
    const match = path.match(/^\/api\/auth\/sessions\/([a-z0-9-]+)$/);
    if (match && method === "DELETE") {
      const body = await readJson(request, AUTH_POLICY.authBodyLimit);
      const { session } = await verifyCurrent(request, body);
      const result = await database
        .prepare("DELETE FROM sessions WHERE id=$1 AND user_id=$2")
        .run(match[1], session.user_id);
      if (!result.rowCount)
        throw new HttpError(404, "该会话已失效。", "session_not_found");
      json(
        response,
        200,
        { ok: true, isCurrent: match[1] === session.id },
        match[1] === session.id && request.authTransport !== "native"
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
