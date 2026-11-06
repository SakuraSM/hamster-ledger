import { Button } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { loginPath, navigateAuth } from "../platform/browser/auth-navigation";

export function IdentityBlockedRecovery(): React.JSX.Element {
  const auth = useAuth();
  const [error, setError] = useState("");
  function recover(): void {
    if (!auth.user) {
      navigateAuth(loginPath("login", "/"));
      return;
    }
    setError("");
    void auth
      .logout()
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "退出账号失败，请重试。",
        ),
      );
  }
  return (
    <>
      <Button disabled={auth.isBusy} onClick={recover}>
        {auth.user ? "退出当前账号并切换" : "登录对应账号"}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
