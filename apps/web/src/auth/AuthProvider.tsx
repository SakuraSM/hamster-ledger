import { useEffect, useRef, useState, type ReactNode } from "react";
import { cloud, CloudError } from "../platform/browser/cloud";
import {
  AUTH_INVALID_EVENT,
  cloudCredentialGeneration,
  setCloudCredentials,
} from "../platform/browser/cloud-request";
import {
  DEFAULT_AUTH_POLICY,
  type AuthInput,
  type AuthReceipt,
  type CloudUser,
  type LoginSession,
} from "../platform/browser/auth-model";
import {
  hasLocalAccess,
  isLocalChoice,
  rememberLocalAccess,
  navigateAuth,
  safeReturnPath,
} from "../platform/browser/auth-navigation";
import { clearVaultSession } from "../platform/browser/vault";
import { AuthContext } from "./auth-context";
const SESSION_CHECK_MS = 60000;
const ACTIVITY_INTERVAL_MS = 60000;
export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [session, setSession] = useState<LoginSession | null>(null);
  const [policy, setPolicy] = useState(DEFAULT_AUTH_POLICY);
  const [isChecking, setIsChecking] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [localAccess, setLocalAccess] = useState(hasLocalAccess);
  const [isLocalOnly, setIsLocalOnly] = useState(isLocalChoice);
  const localOnly = useRef(isLocalOnly);
  const [retryAfter, setRetryAfter] = useState(0);
  const currentUser = useRef(user);
  currentUser.current = user;
  const epoch = useRef(0);
  const mounted = useRef(true);
  const operation = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const lastActivity = useRef(0);
  const hadNetworkError = useRef(false);
  function apply(receipt: AuthReceipt): void {
    setCloudCredentials(
      receipt.user && receipt.csrfToken
        ? { userId: receipt.user.id, csrfToken: receipt.csrfToken }
        : null,
    );
    currentUser.current = receipt.user;
    setUser((current) =>
      current?.id === receipt.user?.id &&
      current?.mustChangePassword === receipt.user?.mustChangePassword &&
      current?.username === receipt.user?.username
        ? current
        : receipt.user,
    );
    setSession(receipt.session);
    if (receipt.policy) setPolicy(receipt.policy);
    setIsOffline(false);
    if (hadNetworkError.current) {
      setError("");
      hadNetworkError.current = false;
    }
  }
  async function refresh(): Promise<void> {
    if (operation.current) return;
    const version = epoch.current;
    try {
      const receipt = await cloud.me();
      if (!mounted.current || version !== epoch.current) return;
      const expired = Boolean(
        (currentUser.current || hasLocalAccess()) &&
        !receipt.user &&
        !localOnly.current,
      );
      apply(
        localOnly.current
          ? { ...receipt, user: null, session: null, csrfToken: null }
          : receipt,
      );
      if (receipt.user && !localOnly.current) {
        rememberLocalAccess(true, "cloud");
        setLocalAccess(true);
      }
      if (expired) setError("登录已失效，云同步已暂停。本机账单已保留。");
    } catch (cause) {
      if (mounted.current && version === epoch.current) {
        hadNetworkError.current = true;
        setIsOffline(true);
        setError(cause instanceof Error ? cause.message : "无法检查登录状态。");
      }
    } finally {
      if (mounted.current) setIsChecking(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const online = (): void => {
      void refresh();
    };
    const expired = (event: Event): void => {
      const detail = (
        event as CustomEvent<{ generation: number; message: string }>
      ).detail;
      if (detail.generation !== cloudCredentialGeneration()) return;
      epoch.current++;
      setCloudCredentials(null);
      currentUser.current = null;
      setUser(null);
      setSession(null);
      setError(detail.message);
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, SESSION_CHECK_MS);
    window.addEventListener("online", online);
    window.addEventListener(AUTH_INVALID_EVENT, expired);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("hamster-ledger.auth");
      channel.current.onmessage = online;
    }
    return () => {
      mounted.current = false;
      epoch.current++;
      clearInterval(interval);
      window.removeEventListener("online", online);
      window.removeEventListener(AUTH_INVALID_EVENT, expired);
      channel.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const activity = (): void => {
      if (
        Date.now() - lastActivity.current < ACTIVITY_INTERVAL_MS ||
        document.visibilityState !== "visible"
      )
        return;
      lastActivity.current = Date.now();
      void cloud.activity(user.id).catch(() => undefined);
    };
    window.addEventListener("pointerdown", activity, { passive: true });
    window.addEventListener("keydown", activity);
    return () => {
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [user?.id, user?.mustChangePassword]);
  async function perform(action: () => Promise<void>): Promise<void> {
    if (operation.current) throw new Error("正在处理登录操作，请稍后。");
    operation.current = true;
    epoch.current++;
    setIsBusy(true);
    setError("");
    setRetryAfter(0);
    try {
      await action();
      channel.current?.postMessage("changed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试。");
      if (cause instanceof CloudError) {
        setRetryAfter(cause.retryAfter);
        setIsOffline(cause.code === "offline");
      }
      throw cause;
    } finally {
      operation.current = false;
      setIsBusy(false);
      setIsChecking(false);
    }
  }
  async function authenticate(input: AuthInput): Promise<void> {
    await perform(async () => {
      const receipt = await cloud.authenticate(input);
      if (!receipt.user || !receipt.csrfToken)
        throw new Error("登录未完成，请重试。");
      localOnly.current = false;
      setIsLocalOnly(false);
      apply(receipt);
      rememberLocalAccess(true, "cloud");
      setLocalAccess(true);
      navigateAuth(
        safeReturnPath(new URLSearchParams(location.search).get("returnTo")),
        true,
      );
    });
  }
  async function logout(): Promise<void> {
    await perform(async () => {
      await cloud.logout(currentUser.current?.id);
      apply({ user: null, csrfToken: null, session: null });
      localOnly.current = false;
      setIsLocalOnly(false);
      rememberLocalAccess(false);
      setLocalAccess(false);
      await clearVaultSession();
      navigateAuth("/login", true);
    });
  }
  function continueLocal(): void {
    epoch.current++;
    setError("");
    setRetryAfter(0);
    localOnly.current = true;
    setIsLocalOnly(true);
    apply({ user: null, session: null, csrfToken: null });
    rememberLocalAccess(true, "local");
    setLocalAccess(true);
    navigateAuth(
      safeReturnPath(new URLSearchParams(location.search).get("returnTo")),
      true,
    );
  }
  async function changePassword(input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    if (!currentUser.current) throw new Error("请先登录。");
    const id = currentUser.current.id;
    await perform(async () => apply(await cloud.changePassword(input, id)));
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        policy,
        isChecking,
        isBusy,
        error,
        isOffline,
        localAccess,
        isLocalOnly,
        retryAfter,
        clearError: () => {
          setError("");
          setRetryAfter(0);
        },
        authenticate,
        logout,
        refresh,
        continueLocal,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
