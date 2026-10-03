import { Button, Text, Card, List } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { useNativeSync } from "../hooks/useNativeSync";
import { useNativeAccount } from "../auth/NativeAccount";
export function SyncScreen({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const account = useNativeAccount();
  const sync = useNativeSync(controller);
  const disabled = sync.isBusy || controller.isLoading || controller.isSaving;
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        云端同步
      </Text>
      {!account.credentials || account.credentials.user.mustChangePassword ? (
        <Text>
          请先到「账号与登录」
          {account.credentials ? "设置新的登录密码" : "登录账号"}
          ，再选择需要同步的账本。
        </Text>
      ) : (
        <>
          <Section title={"已登录 " + account.credentials.user.username}>
            <Text>
              当前账本：
              {
                controller.books.find((book) => book.id === controller.mode)
                  ?.name
              }
            </Text>
            <Text>
              {sync.link
                ? "当前账本已连接。修改后点击立即同步。"
                : "当前账本仅保存在本机。上传会在你的服务器创建副本。"}
            </Text>
            <Text>云端有更新时，先预览再恢复为新账本，保留本机版本。</Text>
            <Button
              mode="contained"
              disabled={disabled}
              loading={sync.isBusy}
              onPress={() => void (sync.link ? sync.sync() : sync.upload())}
            >
              {sync.link ? "立即同步" : "上传当前账本"}
            </Button>
            {sync.link ? (
              <Button
                disabled={disabled}
                onPress={() => void sync.disconnect()}
              >
                断开同步
              </Button>
            ) : null}
          </Section>
          {sync.preview ? (
            <Card mode="outlined">
              <Card.Content style={{ gap: 12 }}>
                <Text variant="titleMedium">
                  云端版本预览 · {sync.preview.name}
                </Text>
                <Text>
                  版本 {sync.preview.revision} ·{" "}
                  {
                    sync.preview.ledger.records.filter(
                      (record) => !record.isDeleted,
                    ).length
                  }{" "}
                  笔账单 · {sync.preview.ledger.accounts.length} 个账户
                </Text>
                <Button
                  mode="contained"
                  disabled={disabled}
                  onPress={() => void sync.restore()}
                >
                  恢复为新账本
                </Button>
                <Button disabled={disabled} onPress={sync.dismissPreview}>
                  关闭预览
                </Button>
              </Card.Content>
            </Card>
          ) : null}
          <Section title="云端账本">
            <Button
              mode="outlined"
              disabled={disabled}
              onPress={() => void sync.refresh()}
            >
              刷新云端列表
            </Button>
            {!sync.books.length ? <Text>还没有云端账本。</Text> : null}
            {sync.books.map((book) => (
              <List.Item
                key={book.id}
                title={book.name}
                description={"版本 " + book.revision}
                onPress={() => {
                  if (!disabled) void sync.inspect(book.id);
                }}
                right={() => <List.Icon icon="chevron-right" />}
              />
            ))}
          </Section>
        </>
      )}
      <ErrorMessage message={sync.error} />
      {sync.message ? (
        <Text accessibilityLiveRegion="polite">{sync.message}</Text>
      ) : null}
    </Screen>
  );
}
