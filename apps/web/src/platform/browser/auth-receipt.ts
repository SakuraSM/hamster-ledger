import type { AuthPolicy, AuthReceipt } from "./auth-model";
import { CloudError } from "./cloud-request";
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const INCOMPATIBLE_SERVICE_STATUS = 502;
function invalid(): never {
  throw new CloudError(INCOMPATIBLE_SERVICE_STATUS, {
    message: "同步服务的登录协议不兼容，请更新并重启服务。",
    code: "service_unavailable",
  });
}
function policy(value: unknown): AuthPolicy {
  if (
    !object(value) ||
    typeof value.allowRegistration !== "boolean" ||
    typeof value.minimumPasswordLength !== "number" ||
    typeof value.maximumPasswordLength !== "number" ||
    typeof value.sessionHours !== "number" ||
    typeof value.rememberDays !== "number" ||
    value.minimumPasswordLength < 1 ||
    value.minimumPasswordLength > value.maximumPasswordLength
  )
    invalid();
  return {
    allowRegistration: value.allowRegistration,
    minimumPasswordLength: value.minimumPasswordLength,
    maximumPasswordLength: value.maximumPasswordLength,
    sessionHours: value.sessionHours,
    rememberDays: value.rememberDays,
  };
}
export function parseAuthReceipt(
  value: unknown,
  requiresPolicy = true,
): AuthReceipt {
  if (!object(value)) invalid();
  const configuration =
    value.policy === undefined
      ? requiresPolicy
        ? invalid()
        : undefined
      : policy(value.policy);
  if (value.user === null && value.csrfToken === null && value.session === null)
    return {
      user: null,
      csrfToken: null,
      session: null,
      policy: configuration,
    };
  if (
    !object(value.user) ||
    typeof value.user.id !== "string" ||
    typeof value.user.username !== "string" ||
    !value.user.id ||
    typeof value.csrfToken !== "string" ||
    !value.csrfToken ||
    !object(value.session) ||
    typeof value.session.id !== "string" ||
    typeof value.session.expiresAt !== "number" ||
    !Number.isFinite(value.session.expiresAt) ||
    typeof value.session.remember !== "boolean"
  )
    invalid();
  return {
    user: {
      id: value.user.id,
      username: value.user.username,
      mustChangePassword: value.user.mustChangePassword === true,
    },
    csrfToken: value.csrfToken,
    session: {
      id: value.session.id,
      expiresAt: value.session.expiresAt,
      remember: value.session.remember,
    },
    policy: configuration,
  };
}
