import { DraftAttachments } from "./DraftAttachments";
import { useMemo, useState } from "react";
import { Button, Card, Checkbox, Text, TextInput } from "react-native-paper";
import * as Crypto from "expo-crypto";
import {
  candidateIssues,
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
import { useNativeAccount } from "../auth/NativeAccount";
import { nativeAttachments } from "../platform/attachments";
import { pickImages } from "../platform/images";
import { localNow, newEntityId } from "../platform/runtime";
import { AdvancedEntryEditor } from "./AdvancedEntryEditor";
import { ModelSettingsPanel } from "./ModelSettingsPanel";
import { Screen, ErrorMessage } from "../ui/Screen";
export function AiScreen({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const account = useNativeAccount(),
    client = account.client,
    model = useModelSettings(client, Boolean(account.credentials));
  const bookId = controller.books.find((book) => book.id === controller.mode)
      ?.cloud?.id,
    remote = useMemo(() => remoteAttachments(client), [client]);
  const ai = useAiLedger({
    controller,
    client,
    profile: model.profile,
    isAuthenticated: Boolean(account.credentials),
    store: bookId ? remote : nativeAttachments,
    storageId: bookId ?? controller.mode,
    localNow,
    newId: newEntityId,
    hash: (value) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
  });
  const [editing, setEditing] = useState<AiDraft | null>(null),
    [imageError, setImageError] = useState("");
  async function select(camera: boolean): Promise<void> {
    try {
      setImageError("");
      ai.addImages(await pickImages(camera));
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : "图片读取失败。");
    }
  }
  const pending =
      controller.ledger.aiDrafts?.filter(
        (draft) => draft.state === "pending",
      ) ?? [],
    canManage = ["owner", "admin"].includes(controller.network?.role ?? "");
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        AI 记账与凭证
      </Text>
      <Text>
        一句话或一张图生成多笔草稿，默认核对后入账。文本可用分号或换行分隔。
      </Text>
      <TextInput
        label="账单描述"
        accessibilityLabel="账单描述"
        multiline
        value={ai.text}
        onChangeText={ai.setText}
      />
      <Button
        mode="outlined"
        icon="image-outline"
        onPress={() => void select(false)}
        disabled={ai.isBusy}
      >
        选择图片
      </Button>
      <Button
        mode="outlined"
        icon="camera-outline"
        onPress={() => void select(true)}
        disabled={ai.isBusy}
      >
        拍摄凭证
      </Button>
      {ai.images.map((image) => (
        <Button
          key={image.id}
          icon="close"
          onPress={() => ai.removeImage(image.id)}
        >
          {image.name}
        </Button>
      ))}
      <Text>
        {model.profile.config
          ? `图片将发送至 ${model.profile.config.endpoint} · ${model.profile.config.model}`
          : "当前使用本地文本规则，图片识别不可用。"}
      </Text>
      <Checkbox.Item
        label="对此联网账本开启 AI 自动入账"
        status={ai.isAutoPost ? "checked" : "unchecked"}
        disabled={!bookId || !canManage || ai.isBusy}
        onPress={() => void ai.setAutoPost(!ai.isAutoPost)}
      />
      <Text variant="bodySmall">
        只自动保存字段完整、账户明确且无重复疑点的普通收支。
      </Text>
      <Button
        mode="contained"
        loading={ai.isBusy}
        disabled={ai.isBusy || controller.isSaving || model.isLoading}
        onPress={() => void ai.recognize()}
      >
        识别并生成草稿
      </Button>
      <ErrorMessage message={ai.error || imageError} />
      <Text variant="titleMedium">待确认草稿（{pending.length}）</Text>
      {pending.map((draft) => (
        <Card key={draft.id} mode="outlined">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">
              {draft.candidate.merchant || "交易对象待确认"}
            </Text>
            <Text>
              {TRANSACTION_LABELS[draft.candidate.type]} ·{" "}
              {draft.candidate.currency}{" "}
              {draft.candidate.amount || "金额待确认"} ·{" "}
              {draft.candidate.date || "日期待确认"}
            </Text>
            <Text>
              分类：{draft.candidate.category} · 账户：
              {controller.ledger.accounts.find(
                (item) => item.id === draft.candidate.accountId,
              )?.name ?? "待选择"}
            </Text>
            <Text variant="bodySmall">
              来源：{draft.sourceLabel} · {draft.attachmentIds.length} 张凭证
            </Text>
            <DraftAttachments
              store={bookId ? remote : nativeAttachments}
              bookId={bookId ?? controller.mode}
              ids={draft.attachmentIds}
            />
            {candidateIssues(controller.ledger, draft.candidate).map(
              (issue) => (
                <Text key={issue}>• {issue}</Text>
              ),
            )}
            <Button
              mode="contained"
              disabled={ai.isBusy}
              onPress={() => setEditing(draft)}
            >
              核对并入账
            </Button>
            <Button
              disabled={ai.isBusy}
              onPress={() => void ai.discard(draft.id)}
            >
              丢弃草稿
            </Button>
          </Card.Content>
        </Card>
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
    </Screen>
  );
}
