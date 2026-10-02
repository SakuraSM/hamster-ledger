import { createHash } from "node:crypto";
import { AUTH_POLICY } from "./auth-policy.mjs";
import { HttpError } from "./http.mjs";
const keyHash = (value) => createHash("sha256").update(value).digest("hex");
export function createAuthLimiter(database, now = Date.now) {
  function consume(scope, value, limit, windowMs) {
    const time = now();
    database.prepare("DELETE FROM auth_limits WHERE resets_at<=?").run(time);
    const key = scope + ":" + keyHash(value);
    const current = database
      .prepare("SELECT attempts,resets_at FROM auth_limits WHERE key=?")
      .get(key);
    if (current && current.attempts >= limit) {
      const seconds = Math.max(1, Math.ceil((current.resets_at - time) / 1000));
      throw new HttpError(
        429,
        `尝试次数过多，请在 ${seconds} 秒后重试。`,
        "rate_limited",
        { "Retry-After": String(seconds) },
      );
    }
    if (
      !current &&
      database.prepare("SELECT COUNT(*) AS count FROM auth_limits").get()
        .count >= 10000
    )
      throw new HttpError(429, "认证请求较多，请稍后重试。", "rate_limited", {
        "Retry-After": "60",
      });
    database
      .prepare(
        "INSERT INTO auth_limits(key,attempts,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1",
      )
      .run(key, time + windowMs);
  }
  return {
    ip(request) {
      consume(
        "ip",
        request.socket.remoteAddress ?? "unknown",
        AUTH_POLICY.ipAttempts,
        AUTH_POLICY.loginWindowMs,
      );
    },
    account(username) {
      consume(
        "account",
        username,
        AUTH_POLICY.accountAttempts,
        AUTH_POLICY.loginWindowMs,
      );
    },
    registration(request) {
      consume(
        "registration",
        request.socket.remoteAddress ?? "unknown",
        AUTH_POLICY.registrationAttempts,
        AUTH_POLICY.registrationWindowMs,
      );
    },
    resetAccount(username) {
      database
        .prepare("DELETE FROM auth_limits WHERE key=?")
        .run("account:" + keyHash(username));
    },
  };
}
