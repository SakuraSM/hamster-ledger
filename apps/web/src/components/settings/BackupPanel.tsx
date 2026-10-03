import { Button, FileInput } from "@mantine/core";
const MAX_BACKUP_MEGABYTES = 20;
const BYTES_PER_KIBIBYTE = 1024;
const JSON_INDENT = 2;
import { useState } from "react";
import { ledgerSchema, type Ledger } from "@hamster-ledger/core";
import { downloadFile, exportExcel } from "../../platform/browser/downloads";
interface Props {
  ledger: Ledger;
  name: string;
  onRestore: (name: string, ledger: Ledger) => Promise<unknown>;
}
export function BackupPanel({
  ledger,
  name,
  onRestore,
}: Props): React.JSX.Element {
  const [preview, setPreview] = useState<Ledger | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function load(file?: File): Promise<void> {
    if (!file) return;
    try {
      if (
        file.size >
        MAX_BACKUP_MEGABYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE
      )
        throw new Error("备份文件不能超过 20 MB。");
      setPreview(ledgerSchema.parse(JSON.parse(await file.text())));
      setError("");
    } catch {
      setPreview(null);
      setError(
        "无法读取备份，请选择仓鼠记账导出的有效 JSON 文件（20 MB 以内）。",
      );
    }
  }
  async function restore(): Promise<void> {
    if (!preview) return;
    setIsSaving(true);
    try {
      await onRestore("恢复的账本", preview);
      setPreview(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "恢复失败");
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <section className="panel">
      <h2>备份与导出</h2>
      <p className="muted">
        完整备份包含账户、分类、预算、周期规则与回收站。备份文件为明文，请自行妥善保存。
      </p>
      <div className="button-row">
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={() =>
            downloadFile({
              name: `仓鼠记账-${name}-备份.json`,
              text: JSON.stringify(ledger, null, JSON_INDENT),
              type: "application/json",
            })
          }
        >
          导出完整备份
        </Button>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={() =>
            void exportExcel(
              ledger.records.filter((record) => !record.isDeleted),
            ).catch(() => setError("Excel 导出失败，请重试。"))
          }
        >
          导出 Excel
        </Button>
      </div>
      <FileInput
        label="恢复 JSON 备份"
        accept=".json,application/json"
        placeholder="选择完整备份文件"
        clearable
        onChange={(file) => void load(file ?? undefined)}
      />
      {preview ? (
        <div className="restore-preview">
          <h3>恢复预览</h3>
          <p>
            {preview.records.filter((record) => !record.isDeleted).length}{" "}
            笔账单 · {preview.accounts.length} 个账户 ·{" "}
            {preview.budgets?.length ?? 0} 项预算
          </p>
          <p>将创建一个新账本，当前账本保留。</p>
          <Button
            variant="filled"
            type="submit"
            className="primary-button"
            disabled={isSaving}
            onClick={() => void restore()}
          >
            恢复为新账本
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
