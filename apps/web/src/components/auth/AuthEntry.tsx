import { Button } from "@mantine/core";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/auth-context";
import {
  AUTH_ROUTE_EVENT,
  navigateAuth,
  safeReturnPath,
} from "../../platform/browser/auth-navigation";
import { LockedApp } from "../LockedApp";
import { AuthPage } from "./AuthPage";
import { PasswordChangePage } from "./PasswordChangePage";
export function AuthEntry(): React.JSX.Element {
  const auth = useAuth();
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = (): void => setPath(location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener(AUTH_ROUTE_EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(AUTH_ROUTE_EVENT, update);
    };
  }, []);
  useEffect(() => {
    if (
      !auth.isChecking &&
      auth.user &&
      !auth.user.mustChangePassword &&
      ["/login", "/register"].includes(path)
    )
      navigateAuth(
        safeReturnPath(new URLSearchParams(location.search).get("returnTo")),
        true,
      );
  }, [auth.isChecking, auth.user, path]);
  if (auth.isChecking && !auth.localAccess)
    return (
      <main className="loading-state" aria-busy="true">
        <img src="/assets/hamster-logo.png" width="64" alt="" />
        <h1>仓鼠记账</h1>
        <p role="status">正在检查登录状态…</p>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={auth.continueLocal}
        >
          仅在本机使用
        </Button>
      </main>
    );
  if (auth.user?.mustChangePassword) return <PasswordChangePage />;
  if (
    path === "/login" ||
    path === "/register" ||
    (!auth.user && !auth.localAccess)
  )
    return <AuthPage mode={path === "/register" ? "register" : "login"} />;
  return <LockedApp />;
}
