import { createHash } from "node:crypto";
import { AUTH_POLICY } from "./auth-policy.mjs";
import { HttpError } from "./http.mjs";
const keyHash = (value) => createHash("sha256").update(value).digest("hex");
export function createAuthLimiter(database, now = Date.now) {
  async function consume(scope, value, limit, windowMs) {
    return database.transaction(async () => {
      const key = scope + ":" + keyHash(value);
      await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
      const time = now();
      await database
        .prepare("DELETE FROM auth_limits WHERE resets_at<=$1")
        .run(time);
      const current = await database
        .prepare("SELECT attempts,resets_at FROM auth_limits WHERE key=$1")
        .get(key);
      if (current && current.attempts >= limit) {
        const seconds = Math.max(
          1,
          Math.ceil((current.resets_at - time) / 1000),
        );
        throw new HttpError(
          429,
          `尝试次数过多，请在 ${seconds} 秒后重试。`,
          "rate_limited",
          { "Retry-After": String(seconds) },
        );
      }
      if (
        !current &&
        (
          await database
            .prepare("SELECT COUNT(*) AS count FROM auth_limits")
            .get()
        ).count >= 10000
      )
        throw new HttpError(429, "认证请求较多，请稍后重试。", "rate_limited", {
          "Retry-After": "60",
        });
      await database
        .prepare(
          "INSERT INTO auth_limits(key,attempts,resets_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=auth_limits.attempts+1",
        )
        .run(key, time + windowMs);
    });
  }
  return {
    async ip(request) {
      await consume(
        "ip",
        request.socket.remoteAddress ?? "unknown",
        AUTH_POLICY.ipAttempts,
        AUTH_POLICY.loginWindowMs,
      );
    },
    async account(username) {
      await consume(
        "account",
        username,
        AUTH_POLICY.accountAttempts,
        AUTH_POLICY.loginWindowMs,
      );
    },
    async registration(request) {
      await consume(
        "registration",
        request.socket.remoteAddress ?? "unknown",
        AUTH_POLICY.registrationAttempts,
        AUTH_POLICY.registrationWindowMs,
      );
    },
    async resetAccount(username) {
      await database
        .prepare("DELETE FROM auth_limits WHERE key=$1")
        .run("account:" + keyHash(username));
    },
  };
}
