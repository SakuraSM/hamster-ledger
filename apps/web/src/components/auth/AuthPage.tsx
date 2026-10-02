import { useAuth } from "../../auth/auth-context";
import {
  navigateAuth,
  loginPath,
} from "../../platform/browser/auth-navigation";
import { AuthLayout } from "./AuthLayout";
import { AuthForm } from "./AuthForm";
export function AuthPage({
  mode,
}: {
  mode: "login" | "register";
}): React.JSX.Element {
  const auth = useAuth();
  const closed = mode === "register" && !auth.policy.allowRegistration;
  return (
    <AuthLayout>
      {closed ? (
        <div className="auth-heading">
          <h1>{auth.isOffline ? "暂时无法创建账号" : "注册尚未开放"}</h1>
          <p>
            {auth.isOffline
              ? "同步服务暂时不可用，恢复连接后可重试。"
              : "请联系服务管理员获取账号，或先在本机记账。"}
          </p>
          <button
            className="primary-button"
            onClick={() => navigateAuth(loginPath("login", "/"))}
          >
            返回登录
          </button>
        </div>
      ) : (
        <AuthForm key={mode} mode={mode} />
      )}
      <div className="auth-local">
        <span>也可以暂时不登录</span>
        <button className="secondary-button" onClick={auth.continueLocal}>
          仅在本机使用
        </button>
        <p>账本留在当前浏览器，登录后可自行选择同步。</p>
      </div>
      {auth.isOffline ? (
        <button
          className="text-button auth-retry"
          onClick={() => void auth.refresh()}
        >
          重新连接同步服务
        </button>
      ) : null}
    </AuthLayout>
  );
}
