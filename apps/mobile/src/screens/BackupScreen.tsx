import { encryptArchive } from "../platform/archive-crypto";
import { nativeStore } from "../platform/storage";
import { archivePassword } from "@hamster-ledger/core";
import { useMemo, useState } from "react";
import { Button, Text, Card, Checkbox, TextInput } from "react-native-paper";
import type { Ledger, Attachment } from "@hamster-ledger/core";
import {
  exportArchive,
  useArchiveProgress,
  restoreArchive,
  cleanupAttachments,
  remoteAttachments,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { Screen, ErrorMessage } from "../ui/Screen";
import { pickBackup, shareBackup, shareExcel } from "../platform/files";
import { nativeAttachments, verifyAttachment } from "../platform/attachments";
import { useNativeAccount } from "../auth/NativeAccount";
export function BackupScreen({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const [preview, setPreview] = useState<{
      ledger: Ledger;
      attachments: Attachment[];
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [isBusy, setBusy] = useState(false);
  const [encrypted, setEncrypted] = useState(false);
  const [password, setPassword] = useState("");
  const progress = useArchiveProgress(nativeStore, controller.mode);
  const client = useNativeAccount().client,
    remote = useMemo(() => remoteAttachments(client), [client]),
    book = controller.books.find((item) => item.id === controller.mode),
    storageId = book?.cloud?.id ?? controller.mode,
    store = book?.cloud ? remote : nativeAttachments;
  async function run(action: () => Promise<void>): Promise<void> {
    if (isBusy) return;
    progress.begin();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件操作失败。");
    } finally {
      progress.finish();
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        备份与导出
      </Text>
      <Text>
        完整归档包含账本、草稿和附件凭证，支持在 Web
        与安卓之间恢复。可选密码加密；密码不会保存，忘记后无法恢复加密文件。
      </Text>
      <Checkbox.Item
        label="使用密码加密备份"
        status={encrypted ? "checked" : "unchecked"}
        disabled={isBusy}
        onPress={() => setEncrypted(!encrypted)}
      />
      <TextInput
        label="备份密码（加密导出或解密恢复）"
        accessibilityLabel="备份密码"
        secureTextEntry
        value={password}
        disabled={isBusy}
        onChangeText={setPassword}
      />
      <Text>
        {progress.lastExport
          ? `最近生成备份：${new Date(progress.lastExport).toLocaleString()}`
          : "尚未在此设备生成备份"}
        。分享后请确认文件已保存。
      </Text>
      {isBusy && (
        <>
          <Text accessibilityLiveRegion="polite">{progress.status}</Text>
          <Button onPress={progress.cancel}>取消操作</Button>
        </>
      )}
      <Button
        mode="contained"
        icon="share-variant"
        disabled={isBusy}
        onPress={() =>
          void run(async () => {
            if (encrypted) archivePassword(password);
            const plain = await exportArchive(
              store,
              storageId,
              controller.ledger,
              progress.options,
            );
            progress.check();
            const text = encrypted
              ? await encryptArchive(plain, password)
              : plain;
            progress.check();
            await shareBackup(text);
            await progress.markExported();
          })
        }
      >
        导出含附件完整备份
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
            setPreview(null);
            const archive = await pickBackup(password);
            progress.check();
            if (archive)
              for (const image of archive.attachments)
                await verifyAttachment(image);
            progress.check();
            setPreview(archive);
          })
        }
      >
        选择归档或 JSON 备份
      </Button>
      {preview ? (
        <Card mode="outlined">
          <Card.Content style={{ gap: 12 }}>
            <Text variant="titleMedium">恢复预览</Text>
            <Text>
              {
                preview.ledger.records.filter((record) => !record.isDeleted)
                  .length
              }{" "}
              笔账单 · {preview.ledger.accounts.length} 个账户 ·{" "}
              {preview.attachments.length} 张凭证
            </Text>
            <Text>将创建一个新的本地账本。</Text>
            <Button
              mode="contained"
              disabled={isBusy || controller.isSaving}
              onPress={() =>
                void run(async () => {
                  await restoreArchive({
                    store: nativeAttachments,
                    ...preview,
                    verify: verifyAttachment,
                    createBook: controller.createBook,
                    progress: progress.options,
                  });
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
      <Text variant="titleMedium">附件清理</Text>
      <Text>
        清理超过 24 小时、未被流水或待确认草稿引用的附件。回收站凭证继续保留。
      </Text>
      <Button
        mode="outlined"
        disabled={isBusy}
        onPress={() =>
          void run(async () => {
            const removed = book?.cloud
              ? (
                  await client.request<{ removed: number }>(
                    `/network/books/${book.cloud.id}/attachments/cleanup`,
                    { method: "POST", body: {} },
                  )
                ).removed
              : await cleanupAttachments(
                  store,
                  storageId,
                  controller.ledger,
                  Date.now(),
                );
            setMessage(`已清理 ${removed} 张未使用附件。`);
          })
        }
      >
        清理未使用附件
      </Button>
      <ErrorMessage message={error} />
      {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    </Screen>
  );
}
