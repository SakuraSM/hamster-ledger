import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Text, List } from "react-native-paper";
import { useNativeAccount } from "./NativeAccount";
import { PasswordInput } from "./PasswordInput";
import { ErrorMessage, Section } from "../ui/Screen";
import { ReceiptAction } from "../screens/ReceiptAction";
const DEFAULT_MIN_PASSWORD_LENGTH = 15;
import type { DeviceSession } from "../platform/cloud-client";
export function SecurityPanel(): React.JSX.Element {
  const account = useNativeAccount();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const identity = JSON.stringify([
    account.server,
    account.credentials?.user.id,
    account.credentials?.session.id,
  ]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const principal = JSON.stringify([
    account.server,
    account.credentials?.user.id,
  ]);
  const currentPrincipal = useRef(principal);
  currentPrincipal.current = principal;
  const previousIdentity = useRef(identity);
  const previousPrincipal = useRef(principal);
  useLayoutEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    const isSamePrincipal = previousPrincipal.current === principal;
    previousPrincipal.current = principal;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setError("");
    if (!isSamePrincipal) setMessage("");
  }, [identity, principal]);
  const [sessionData, setSessionData] = useState<{
    identity: string;
    sessions: DeviceSession[];
  }>({ identity, sessions: [] });
  const sessions =
    sessionData.identity === identity ? sessionData.sessions : [];
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const actionInProgress = useRef(false);
  const temporary = account.credentials?.user.mustChangePassword;
  useEffect(() => {
    let active = true;
    if (account.credentials && !temporary)
      void account.client
        .sessions()
        .then((value) => {
          if (active) setSessionData({ identity, sessions: value.sessions });
        })
        .catch((cause) => {
          if (active)
            setError(cause instanceof Error ? cause.message : "读取设备失败。");
        });
    return () => {
      active = false;
    };
  }, [identity, temporary]);
  async function run(action: () => Promise<void>): Promise<void> {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      if (currentIdentity.current === identity)
        setError(cause instanceof Error ? cause.message : "账号操作失败。");
    } finally {
      actionInProgress.current = false;
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
          key={`${identity}:current`}
          label="当前密码"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          disabled={isBusy}
        />
        <PasswordInput
          key={`${identity}:new`}
          label="新密码"
          value={newPassword}
          onChangeText={setNewPassword}
          isNew
          disabled={isBusy}
        />
        <Text>
          新密码至少{" "}
          {account.policy?.minimumPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH}{" "}
          位。
        </Text>
        <PasswordInput
          key={`${identity}:confirmation`}
          label="再次输入新密码"
          value={confirmation}
          onChangeText={setConfirmation}
          isNew
          disabled={isBusy}
        />
        <ReceiptAction
          disabled={isBusy || !currentPassword || !newPassword}
          loading={isBusy}
          onPress={() =>
            void run(async () => {
              if (newPassword !== confirmation)
                throw new Error("两次新密码不一致。");
              await account.changePassword(currentPassword, newPassword);
              if (currentPrincipal.current !== principal) return;
              setCurrentPassword("");
              setNewPassword("");
              setConfirmation("");
              setMessage("密码已更新，其他设备已退出。");
            })
          }
        >
          更新密码
        </ReceiptAction>
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
                    accessibilityLabel={`退出 ${session.deviceName} 设备`}
                    contentStyle={{ minHeight: 48 }}
                    onPress={() =>
                      void run(async () => {
                        await account.client.revoke(
                          session.id,
                          currentPassword,
                        );
                        const updated = await account.client.sessions();
                        if (currentIdentity.current !== identity) return;
                        setSessionData({
                          identity,
                          sessions: updated.sessions,
                        });
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
