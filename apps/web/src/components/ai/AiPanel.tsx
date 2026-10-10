import { DraftAttachments } from "./DraftAttachments";
import { useMemo, useState } from "react";
import { Alert, Button, Checkbox, FileInput, Textarea } from "@mantine/core";
import {
  candidateIssues,
  cycleMonthForDate,
  TRANSACTION_LABELS,
  type AiDraft,
} from "@hamster-ledger/core";
import {
  useAiLedger,
  useModelSettings,
  remoteAttachments,
  aiEntryDraft,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { useAuth } from "../../auth/auth-context";
import { useNetworkClient } from "../../hooks/useNetworkController";
import {
  browserAttachments,
  imageAttachment,
} from "../../platform/browser/attachments";
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { AdvancedEntryEditor } from "../finance/AdvancedEntryEditor";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
async function hash(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function AiPanel({
  controller,
  onMonth,
}: {
  controller: LedgerController;
  onMonth: (month: string) => void;
}): React.JSX.Element {
  const auth = useAuth(),
    client = useNetworkClient(),
    model = useModelSettings(client, Boolean(auth.user));
  const bookId = controller.books.find((book) => book.id === controller.mode)
    ?.cloud?.id;
  const remote = useMemo(() => remoteAttachments(client), [client]);
  const ai = useAiLedger({
    controller,
    client,
    profile: model.profile,
    isAuthenticated: Boolean(auth.user),
    store: bookId ? remote : browserAttachments,
    storageId: bookId ?? controller.mode,
    localNow,
    newId: newEntityId,
    hash,
    onPosted: (date) =>
      onMonth(
        cycleMonthForDate(
          date,
          controller.ledger.preferences?.cycleStartDay ?? 1,
        ),
      ),
  });
  const [editing, setEditing] = useState<AiDraft | null>(null),
    [fileError, setFileError] = useState("");
  async function select(files: File[]): Promise<void> {
    try {
      setFileError("");
      if (files.length > 5) throw new Error("每次最多选择 5 张图片。");
      ai.addImages(await Promise.all(files.map(imageAttachment)));
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "图片读取失败。");
    }
  }
  const pending =
    controller.ledger.aiDrafts?.filter((draft) => draft.state === "pending") ??
    [];
  const canManage =
    !bookId || ["owner", "admin"].includes(controller.network?.role ?? "");
  return (
    <section
      className="panel"
      style={{ gridColumn: "1 / -1", overflowWrap: "anywhere" }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void select(Array.from(event.dataTransfer.files));
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length) {
          event.preventDefault();
          void select(files);
        }
      }}
    >
      <h2>AI 记账与凭证</h2>
      <p className="muted">
        一句话或一张图可生成多笔草稿。默认逐笔核对；文本可用分号或换行分隔。
      </p>
      <Textarea
        label="账单描述"
        placeholder="虚拟现金 餐饮 28.50元；虚拟现金 交通 6元"
        value={ai.text}
        onChange={(event) => ai.setText(event.currentTarget.value)}
        minRows={3}
        autosize
      />
      <FileInput
        label="选择图片，也可拖入或粘贴"
        placeholder="点此选择图片（最多 5 张）"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        value={[]}
        onChange={(files) => void select(files)}
      />
      {ai.images.map((image) => (
        <div className="stat-row" key={image.id}>
          <span>{image.name}</span>
          <Button
            variant="subtle"
            onClick={() => ai.removeImage(image.id)}
            aria-label={`移除图片 ${image.name}`}
          >
            移除
          </Button>
        </div>
      ))}
      <p>
        {model.profile.config
          ? `图片将发送至 ${model.profile.config.endpoint} · ${model.profile.config.model}`
          : "当前使用本地文本规则，图片识别不可用。"}
      </p>
      <Checkbox
        label="对此联网账本开启 AI 自动入账"
        checked={ai.isAutoPost}
        disabled={!bookId || !canManage || ai.isBusy}
        onChange={(event) => void ai.setAutoPost(event.currentTarget.checked)}
      />
      <p className="muted">
        只自动保存字段完整、账户明确且无重复疑点的普通收支。其他结果仍进入草稿。
      </p>
      <Button
        disabled={ai.isBusy || controller.isSaving || model.isLoading}
        loading={ai.isBusy}
        onClick={() => void ai.recognize()}
      >
        识别并生成草稿
      </Button>
      {ai.error || fileError ? (
        <Alert color="red" role="alert">
          {ai.error || fileError}
        </Alert>
      ) : null}
      <h3>待确认草稿（{pending.length}）</h3>
      {pending.map((draft) => (
        <article className="panel" key={draft.id}>
          <h4>{draft.candidate.merchant || "交易对象待确认"}</h4>
          <p>
            {TRANSACTION_LABELS[draft.candidate.type]} ·{" "}
            {draft.candidate.currency} {draft.candidate.amount || "金额待确认"}{" "}
            · {draft.candidate.date || "日期待确认"}
          </p>
          <p>
            分类：{draft.candidate.category} · 账户：
            {controller.ledger.accounts.find(
              (account) => account.id === draft.candidate.accountId,
            )?.name ?? "待选择"}
          </p>
          <p className="muted">
            来源：{draft.sourceLabel} · {draft.attachmentIds.length} 张凭证
          </p>
          <DraftAttachments
            store={bookId ? remote : browserAttachments}
            bookId={bookId ?? controller.mode}
            ids={draft.attachmentIds}
          />
          {candidateIssues(controller.ledger, draft.candidate).length ? (
            <ul>
              {candidateIssues(controller.ledger, draft.candidate).map(
                (issue) => (
                  <li key={issue}>{issue}</li>
                ),
              )}
            </ul>
          ) : (
            <p>规则校验通过，请核对后入账。</p>
          )}
          <div className="button-row">
            <Button onClick={() => setEditing(draft)} disabled={ai.isBusy}>
              核对并入账
            </Button>
            <Button
              variant="subtle"
              onClick={() => void ai.discard(draft.id)}
              disabled={ai.isBusy}
            >
              丢弃草稿
            </Button>
          </div>
        </article>
      ))}
      <ModelSettingsPanel form={model} />
      {editing ? (
        <AdvancedEntryEditor
          key={editing.id}
          ledger={controller.ledger}
          bookId={bookId}
          initialDraft={aiEntryDraft(editing)}
          onSave={(next) => ai.confirm(editing, next)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
