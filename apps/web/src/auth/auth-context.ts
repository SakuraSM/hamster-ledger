import { createContext, useContext } from "react";
import type {
  AuthInput,
  AuthPolicy,
  CloudUser,
  LoginSession,
} from "../platform/browser/auth-model";
export interface AuthController {
  user: CloudUser | null;
  session: LoginSession | null;
  policy: AuthPolicy;
  isChecking: boolean;
  isBusy: boolean;
  error: string;
  isOffline: boolean;
  localAccess: boolean;
  isLocalOnly: boolean;
  retryAfter: number;
  clearError: () => void;
  authenticate: (input: AuthInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  continueLocal: () => void;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
}
export const AuthContext = createContext<AuthController | null>(null);
export function useAuth(): AuthController {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required.");
  return context;
}
