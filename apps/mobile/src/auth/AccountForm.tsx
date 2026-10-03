const DEFAULT_MIN_PASSWORD_LENGTH = 15;
import { useState } from "react";
import {
  Button,
  Checkbox,
  Text,
  TextInput,
  SegmentedButtons,
} from "react-native-paper";
import { useNativeAccount } from "./NativeAccount";
import { PasswordInput } from "./PasswordInput";
import { ErrorMessage, Section } from "../ui/Screen";
export function AccountForm(): React.JSX.Element {
  const account = useNativeAccount();
  const [server, setServer] = useState(account.server);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [mode, setMode] = useState("login");
  const [remember, setRemember] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>): Promise<void> {
    if (isBusy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败。");
    } finally {
      setBusy(false);
    }
  }
  const connected = Boolean(
    account.server &&
    account.policy &&
    server.trim().replace(/\/$/, "") === account.server,
  );
  return (
    <>
      <Section title="连接记账服务">
        <Text>
          填写你部署的服务地址。账号只用于同步，本机记账可以离线使用。
        </Text>
        <TextInput
          mode="outlined"
          label="服务地址"
          accessibilityLabel="服务地址"
          value={server}
          placeholder="https://ledger.example.com"
          onChangeText={setServer}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          disabled={isBusy}
        />
        <Button
          mode="outlined"
          loading={isBusy}
          disabled={isBusy || !server.trim()}
          onPress={() => void run(() => account.connect(server))}
        >
          {connected ? "重新连接服务" : "连接服务"}
        </Button>
      </Section>
      {connected ? (
        <Section title="登录账号">
          <SegmentedButtons
            value={mode}
            onValueChange={setMode}
            buttons={[
              { value: "login", label: "登录", disabled: isBusy },
              {
                value: "register",
                label: "注册",
                disabled: isBusy || !account.policy?.allowRegistration,
              },
            ]}
          />
          {!account.policy?.allowRegistration ? (
            <Text>此服务已关闭注册，请联系管理员。</Text>
          ) : null}
          <TextInput
            mode="outlined"
            label="账号"
            accessibilityLabel="账号"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            disabled={isBusy}
          />
          <PasswordInput
            label="密码"
            value={password}
            onChangeText={setPassword}
            isNew={mode === "register"}
            disabled={isBusy}
          />
          {mode === "register" ? (
            <>
              <Text>
                密码至少{" "}
                {account.policy?.minimumPasswordLength ??
                  DEFAULT_MIN_PASSWORD_LENGTH}{" "}
                位，可使用便于记忆的长短语。
              </Text>
              <PasswordInput
                label="确认密码"
                value={confirmation}
                onChangeText={setConfirmation}
                isNew
                disabled={isBusy}
              />
            </>
          ) : null}
          <Checkbox.Item
            label="记住登录 30 天（仅在自己的设备上启用）"
            status={remember ? "checked" : "unchecked"}
            onPress={() => setRemember(!remember)}
            disabled={isBusy}
          />
          <Button
            mode="contained"
            disabled={isBusy || !username.trim() || !password}
            loading={isBusy}
            onPress={() =>
              void run(async () => {
                if (mode === "register" && password !== confirmation)
                  throw new Error("两次密码不一致。");
                await account.authenticate({
                  username: username.trim(),
                  password,
                  remember,
                  isRegister: mode === "register",
                });
                setPassword("");
                setConfirmation("");
              })
            }
          >
            {mode === "register" ? "注册并登录" : "登录"}
          </Button>
          <Text>
            忘记密码时，请联系服务管理员重置。临时密码登录后需要先设置新密码。
          </Text>
        </Section>
      ) : null}
      <ErrorMessage message={error || account.error} />
    </>
  );
}
