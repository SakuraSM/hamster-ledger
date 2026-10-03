import { useEffect, useState } from "react";
import { Button, Text, List } from "react-native-paper";
import { useNativeAccount } from "./NativeAccount";
import { PasswordInput } from "./PasswordInput";
import { ErrorMessage, Section } from "../ui/Screen";
import type { DeviceSession } from "../platform/cloud-client";
export function SecurityPanel(): React.JSX.Element {
  const account = useNativeAccount();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const temporary = account.credentials?.user.mustChangePassword;
  useEffect(() => {
    let active = true;
    if (!temporary)
      void account.client
        .sessions()
        .then((value) => {
          if (active) setSessions(value.sessions);
        })
        .catch((cause) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "读取设备失败。");
        });
    return () => {
      active = false;
    };
  }, [account.credentials?.session.id, temporary]);
  async function run(action: () => Promise<void>): Promise<void> {
    if (isBusy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账号操作失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section title={temporary ? "设置新的登录密码" : "账号安全"}>
        <Text>
          {temporary
            ? "这是临时密码，请先设置新密码再使用同步。"
            : "修改密码后，其他设备需要重新登录。"}
        </Text>
        <PasswordInput
          label="当前密码"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          disabled={isBusy}
        />
        <PasswordInput
          label="新密码"
          value={newPassword}
          onChangeText={setNewPassword}
          isNew
          disabled={isBusy}
        />
        <Text>新密码至少 15 位。</Text>
        <PasswordInput
          label="再次输入新密码"
          value={confirmation}
          onChangeText={setConfirmation}
          isNew
          disabled={isBusy}
        />
        <Button
          mode="contained"
          disabled={isBusy || !currentPassword || !newPassword}
          loading={isBusy}
          onPress={() =>
            void run(async () => {
              if (newPassword !== confirmation)
                throw new Error("两次新密码不一致。");
              await account.changePassword(currentPassword, newPassword);
              setCurrentPassword("");
              setNewPassword("");
              setConfirmation("");
              setMessage("密码已更新，其他设备已退出。");
            })
          }
        >
          更新密码
        </Button>
      </Section>
      {!temporary ? (
        <Section title="登录设备">
          <Text>退出设备前，请在上方填写当前密码。</Text>
          {sessions.map((session) => (
            <List.Item
              key={session.id}
              title={
                session.deviceName + (session.isCurrent ? " · 当前设备" : "")
              }
              description={
                "有效至 " +
                new Date(session.expiresAt).toLocaleDateString("zh-CN")
              }
              right={() =>
                session.isCurrent ? null : (
                  <Button
                    disabled={isBusy || !currentPassword}
                    onPress={() =>
                      void run(async () => {
                        await account.client.revoke(
                          session.id,
                          currentPassword,
                        );
                        setSessions((await account.client.sessions()).sessions);
                        setMessage("该设备已退出。");
                      })
                    }
                  >
                    退出设备
                  </Button>
                )
              }
            />
          ))}
        </Section>
      ) : null}
      <ErrorMessage message={error} />
      {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    </>
  );
}
