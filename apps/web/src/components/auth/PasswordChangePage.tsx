import { Button } from "@mantine/core";
import { useAuth } from "../../auth/auth-context";
import { AuthLayout } from "./AuthLayout";
import { PasswordChangeForm } from "./PasswordChangeForm";
export function PasswordChangePage(): React.JSX.Element {
  const auth = useAuth();
  return (
    <AuthLayout>
      <div className="auth-heading">
        <h1>设置新的登录密码</h1>
        <p>你正在使用管理员重置的临时密码，设置新密码后即可继续同步。</p>
      </div>
      <PasswordChangeForm />
      <Button
        variant="subtle"
        type="submit"
        className="text-button auth-retry"
        disabled={auth.isBusy}
        onClick={() => void auth.logout().catch(() => undefined)}
      >
        退出当前账号
      </Button>
    </AuthLayout>
  );
}
