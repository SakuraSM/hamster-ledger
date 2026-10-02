export const AUTH_POLICY = {
  minimumPasswordLength: 15,
  maximumPasswordLength: 256,
  authBodyLimit: 8192,
  sessionSeconds: 12 * 60 * 60,
  sessionIdleSeconds: 30 * 60,
  rememberSeconds: 30 * 24 * 60 * 60,
  rememberIdleSeconds: 7 * 24 * 60 * 60,
  maximumSessions: 5,
  loginWindowMs: 15 * 60 * 1000,
  accountAttempts: 10,
  ipAttempts: 40,
  registrationWindowMs: 60 * 60 * 1000,
  registrationAttempts: 5,
  scrypt: { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
  legacyScrypt: { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  hashBytes: 64,
  saltBytes: 16,
  maximumHashJobs: 2,
};
export const AUTH_FAILURE = "账号或密码错误。";
export function publicAuthPolicy(allowRegistration) {
  return {
    allowRegistration,
    minimumPasswordLength: AUTH_POLICY.minimumPasswordLength,
    maximumPasswordLength: AUTH_POLICY.maximumPasswordLength,
    sessionHours: AUTH_POLICY.sessionSeconds / 3600,
    rememberDays: AUTH_POLICY.rememberSeconds / 86400,
  };
}
