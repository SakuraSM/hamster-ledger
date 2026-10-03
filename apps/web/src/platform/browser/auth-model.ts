export interface CloudUser {
  id: string;
  username: string;
  mustChangePassword?: boolean;
}
export interface AuthPolicy {
  allowRegistration: boolean;
  minimumPasswordLength: number;
  maximumPasswordLength: number;
  sessionHours: number;
  rememberDays: number;
}
export interface LoginSession {
  id: string;
  expiresAt: number;
  remember: boolean;
}
export interface AuthReceipt {
  user: CloudUser | null;
  csrfToken: string | null;
  session: LoginSession | null;
  policy?: AuthPolicy;
}
export interface AuthInput {
  username: string;
  password: string;
  isRegister: boolean;
  remember?: boolean;
}
export interface DeviceSession {
  id: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  remember: boolean;
  deviceName: string;
  isCurrent: boolean;
}
export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  allowRegistration: false,
  minimumPasswordLength: 15,
  maximumPasswordLength: 256,
  sessionHours: 12,
  rememberDays: 30,
};
