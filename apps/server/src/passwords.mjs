import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { AUTH_POLICY } from "./auth-policy.mjs";
import { HttpError } from "./http.mjs";
const derive = promisify(scrypt);
let activeJobs = 0;
const COMMON_PASSWORDS = new Set([
  "123456789012345",
  "1234567890123456",
  "passwordpassword",
  "password123456789",
  "qwertyuiopasdfgh",
  "111111111111111",
  "000000000000000",
]);
export function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export function isValidUsername(value) {
  return /^[a-z0-9][a-z0-9_.@-]{2,63}$/.test(value);
}
export function validateNewPassword(password) {
  if (
    typeof password !== "string" ||
    [...password].length < AUTH_POLICY.minimumPasswordLength ||
    [...password].length > AUTH_POLICY.maximumPasswordLength ||
    password.includes("\0")
  )
    throw new HttpError(
      400,
      `密码需为 ${AUTH_POLICY.minimumPasswordLength}–${AUTH_POLICY.maximumPasswordLength} 个字符。`,
      "invalid_password",
    );
  if (
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    /^(.)\1+$/u.test(password)
  )
    throw new HttpError(
      400,
      "这个密码过于常见，请使用更长的独特密码或短语。",
      "weak_password",
    );
}
export function isLoginPassword(password) {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    [...password].length <= AUTH_POLICY.maximumPasswordLength &&
    !password.includes("\0")
  );
}
async function hash(password, salt, parameters) {
  if (activeJobs >= AUTH_POLICY.maximumHashJobs)
    throw new HttpError(429, "认证请求较多，请稍后重试。", "auth_busy", {
      "Retry-After": "2",
    });
  activeJobs++;
  try {
    return await derive(password, salt, AUTH_POLICY.hashBytes, parameters);
  } finally {
    activeJobs--;
  }
}
export async function createPassword(password, { validate = true } = {}) {
  if (validate) validateNewPassword(password);
  const salt = randomBytes(AUTH_POLICY.saltBytes).toString("hex");
  const result = await hash(password, salt, AUTH_POLICY.scrypt);
  return { salt, passwordHash: result.toString("hex"), passwordVersion: 2 };
}
export async function verifyPassword(password, user) {
  const isModern = !user || user.password_version === 2;
  const salt = user?.salt ?? "0".repeat(AUTH_POLICY.saltBytes * 2);
  const actual = await hash(
    password,
    salt,
    isModern ? AUTH_POLICY.scrypt : AUTH_POLICY.legacyScrypt,
  );
  const expected = Buffer.from(
    user?.password_hash ?? "0".repeat(AUTH_POLICY.hashBytes * 2),
    "hex",
  );
  return (
    expected.length === actual.length &&
    timingSafeEqual(actual, expected) &&
    Boolean(user)
  );
}
