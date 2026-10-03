import { useState } from "react";
import { Button, Text, ActivityIndicator } from "react-native-paper";
import { Screen, ErrorMessage, Section } from "../ui/Screen";
import { useNativeAccount } from "../auth/NativeAccount";
import { AccountForm } from "../auth/AccountForm";
import { SecurityPanel } from "../auth/SecurityPanel";
export function AccountScreen({
  onLocal,
}: {
  onLocal?: () => void;
}): React.JSX.Element {
  const account = useNativeAccount();
  const [error, setError] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账号操作失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        {onLocal ? "欢迎使用仓鼠记账" : "账号与登录"}
      </Text>
      {account.isLoading ? (
        <ActivityIndicator />
      ) : account.credentials ? (
        <>
          <Section title={"已登录 " + account.credentials.user.username}>
            <Text>{account.server}</Text>
            <Text>
              登录不会自动上传账本。请到「云端同步」选择要同步的账本。
            </Text>
            {!account.credentials.user.mustChangePassword ? (
              <Button
                mode="outlined"
                onPress={() => setShowSecurity(!showSecurity)}
              >
                {showSecurity ? "收起账号安全" : "密码与登录设备"}
              </Button>
            ) : null}
            <Button disabled={isBusy} onPress={() => void run(account.logout)}>
              退出账号
            </Button>
          </Section>
          {showSecurity || account.credentials.user.mustChangePassword ? (
            <SecurityPanel />
          ) : null}
        </>
      ) : (
        <AccountForm />
      )}
      {onLocal ? (
        <Button
          mode="text"
          disabled={account.isLoading || isBusy}
          onPress={() =>
            void run(async () => {
              await account.continueLocal();
              onLocal();
            })
          }
        >
          仅在本机使用
        </Button>
      ) : null}
      <ErrorMessage message={error} />
    </Screen>
  );
}
