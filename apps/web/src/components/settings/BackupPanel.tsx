import {
  encryptArchive,
  decryptArchive,
} from "../../platform/browser/archive-crypto";
import { protectedStore } from "../../platform/browser/vault";
import { Button, FileInput, Checkbox, PasswordInput } from "@mantine/core";
import { useMemo, useState } from "react";
import {
  parseArchive,
  archivePassword,
  MAX_ENCRYPTED_ARCHIVE_BYTES,
  type Ledger,
  type Attachment,
} from "@hamster-ledger/core";
import {
  exportArchive,
  useArchiveProgress,
  restoreArchive,
  cleanupAttachments,
  remoteAttachments,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { downloadFile, exportExcel } from "../../platform/browser/downloads";
import {
  browserAttachments,
  verifyAttachment,
} from "../../platform/browser/attachments";
import { useNetworkClient } from "../../hooks/useNetworkController";
export function BackupPanel({
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
  const [file, setFile] = useState<File | null>(null);
  const progress = useArchiveProgress(protectedStore, controller.mode);
  const client = useNetworkClient(),
    remote = useMemo(() => remoteAttachments(client), [client]),
    book = controller.books.find((item) => item.id === controller.mode),
    storageId = book?.cloud?.id ?? controller.mode,
    store = book?.cloud ? remote : browserAttachments;
  async function run(action: () => Promise<void>): Promise<void> {
    if (isBusy) return;
    progress.begin();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "备份操作失败。");
    } finally {
      progress.finish();
      setBusy(false);
    }
  }
  async function load(file: File | null): Promise<void> {
    setPreview(null);
    if (!file) return;
    await run(async () => {
      if (file.size > MAX_ENCRYPTED_ARCHIVE_BYTES)
        throw new Error("备份文件不能超过 224 MiB。");
      const parsed = parseArchive(
        await decryptArchive(await file.text(), password),
      );
      progress.check();
      for (const attachment of parsed.attachments)
        await verifyAttachment(attachment);
      progress.check();
      setPreview(parsed);
    });
  }
  return (
    <section className="panel">
      <h2>备份与导出</h2>
      <p className="muted">
        完整归档包含账本、草稿与附件凭证，继续支持旧 JSON
        导入。可选择密码加密；密码不会保存，忘记后无法恢复加密文件。
      </p>
      <Checkbox
        label="使用密码加密备份"
        checked={encrypted}
        disabled={isBusy}
        onChange={(event) => setEncrypted(event.target.checked)}
      />
      <PasswordInput
        label="备份密码（加密导出或解密恢复）"
        visibilityToggleButtonProps={{ "aria-label": "显示或隐藏备份密码" }}
        value={password}
        disabled={isBusy}
        autoComplete="new-password"
        onChange={(event) => setPassword(event.target.value)}
      />
      <p className="muted">
        {progress.lastExport
          ? `最近生成备份：${new Date(progress.lastExport).toLocaleString()}`
          : "尚未在此设备生成备份"}
        。生成后请确认文件已保存。
      </p>
      {isBusy && (
        <div role="status">
          <p>{progress.status}</p>
          <Button variant="subtle" onClick={progress.cancel}>
            取消操作
          </Button>
        </div>
      )}
      <div className="button-row">
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() =>
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
              downloadFile({
                name: `仓鼠记账-${book?.name ?? "账本"}-备份.hamster`,
                text,
                type: "application/json",
              });
              await progress.markExported();
            })
          }
        >
          导出含附件完整备份
        </Button>
        <Button
          variant="outline"
          disabled={isBusy}
          onClick={() =>
            void run(() =>
              exportExcel(
                controller.ledger.records.filter((record) => !record.isDeleted),
              ),
            )
          }
        >
          导出 Excel
        </Button>
      </div>
      <FileInput
        label="恢复归档或 JSON 备份"
        accept=".hamster,.json,application/json"
        placeholder="选择备份文件"
        clearable
        disabled={isBusy}
        value={file}
        onChange={(next) => {
          setFile(next);
          setPreview(null);
        }}
      />
      <Button
        variant="outline"
        disabled={isBusy || !file}
        onClick={() => void load(file)}
      >
        读取备份并预览
      </Button>
      {preview ? (
        <div className="restore-preview">
          <h3>恢复预览</h3>
          <p>
            {
              preview.ledger.records.filter((record) => !record.isDeleted)
                .length
            }{" "}
            笔账单 · {preview.ledger.accounts.length} 个账户 ·{" "}
            {preview.attachments.length} 张凭证
          </p>
          <p>将创建一个新的本地账本。</p>
          <Button
            disabled={isBusy}
            onClick={() =>
              void run(async () => {
                await restoreArchive({
                  store: browserAttachments,
                  ...preview,
                  verify: verifyAttachment,
                  createBook: controller.createBook,
                  progress: progress.options,
                });
                setPreview(null);
                controller.notify("已恢复为新账本，原账本保留。");
              })
            }
          >
            恢复为新账本
          </Button>
        </div>
      ) : null}
      <h3>附件清理</h3>
      <p className="muted">
        清理超过 24
        小时且未被流水或待确认草稿引用的附件。回收站中的凭证继续保留。
      </p>
      <Button
        variant="outline"
        disabled={isBusy}
        onClick={() =>
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
            setMessage(`已清理 ${removed} 张未使用的附件。`);
          })
        }
      >
        清理未使用附件
      </Button>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
