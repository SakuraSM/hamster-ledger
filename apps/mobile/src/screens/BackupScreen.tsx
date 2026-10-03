import { useState } from "react";
import { Button, Text, Card } from "react-native-paper";
import type { Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, ErrorMessage } from "../ui/Screen";
import { pickBackup, shareBackup, shareExcel } from "../platform/files";
interface BackupScreenProps {
  controller: LedgerController;
}
export function BackupScreen({
  controller,
}: BackupScreenProps): React.JSX.Element {
  const [preview, setPreview] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  async function run(action: () => Promise<void>): Promise<void> {
    setIsBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件操作失败");
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        备份与导出
      </Text>
      <Text>
        完整备份包含分类、账户、周期规则和回收站。导出的文件为明文，请存放到你信任的位置。可在
        Web 和安卓之间恢复。
      </Text>
      <Button
        mode="contained"
        icon="share-variant"
        disabled={isBusy}
        onPress={() => void run(() => shareBackup(controller.ledger))}
      >
        导出完整备份
      </Button>
      <Button
        mode="outlined"
        icon="table"
        disabled={isBusy}
        onPress={() => void run(() => shareExcel(controller.ledger))}
      >
        导出 Excel
      </Button>
      <Button
        mode="outlined"
        icon="file-restore"
        disabled={isBusy}
        onPress={() =>
          void run(async () => {
            setPreview(await pickBackup());
          })
        }
      >
        选择 JSON 备份
      </Button>
      {preview ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: 12 }}>
            <Text variant="titleMedium">恢复预览</Text>
            <Text>
              {preview.records.filter((record) => !record.isDeleted).length}{" "}
              笔账单 · {preview.accounts.length} 个账户 ·{" "}
              {preview.budgets?.length ?? 0} 项预算
            </Text>
            <Text>将创建一个新账本，当前账本保留。</Text>
            <Button
              mode="contained"
              disabled={isBusy || controller.isSaving}
              onPress={() =>
                void run(async () => {
                  await controller.createBook("恢复的账本", preview);
                  setPreview(null);
                  controller.notify("已恢复为新账本");
                })
              }
            >
              恢复为新账本
            </Button>
            <Button onPress={() => setPreview(null)}>取消恢复</Button>
          </Card.Content>
        </Card>
      ) : null}
      <ErrorMessage message={error} />
    </Screen>
  );
}
