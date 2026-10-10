import { Button, Checkbox, TextInput } from "react-native-paper";
import {
  TRANSACTION_LABELS,
  TRANSACTION_TYPES,
  categoryNames,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import {
  useAdvancedEntry,
  useBookMembers,
  type EntryDraft,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../platform/runtime";
import { useNativeAccount } from "../auth/NativeAccount";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
import { EntryMoneyFields } from "./EntryMoneyFields";
import { EntrySplitFields } from "./EntrySplitFields";
export function AdvancedEntryEditor({
  ledger,
  record,
  date,
  bookId,
  initialDraft,
  onSave,
  onClose,
}: {
  ledger: Ledger;
  record?: BillRecord;
  date?: string;
  bookId?: string;
  initialDraft?: Partial<EntryDraft>;
  onSave: (ledger: Ledger, date: string) => Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const client = useNativeAccount().client;
  const form = useAdvancedEntry({
    ledger,
    record,
    initialDraft,
    now: date ? date + " 12:00:00" : localNow(),
    newId: newEntityId,
    client,
    onSave,
    onClose,
  });
  const members = useBookMembers(client, bookId);
  const { draft, change } = form;
  return (
    <FormSheet
      title={record ? "编辑完整交易" : "完整交易记账"}
      onClose={onClose}
      hasUnsavedChanges
    >
      <ChoiceField
        label="交易类型"
        value={draft.type}
        options={TRANSACTION_TYPES.map((value) => ({
          value,
          label: TRANSACTION_LABELS[value],
        }))}
        onChange={(value) => change("type", value as typeof draft.type)}
      />
      <TextInput
        label="商户 / 交易名称"
        value={draft.merchant}
        onChangeText={(value) => change("merchant", value)}
      />
      <DateField
        label="交易时间"
        value={draft.date}
        withTime
        onChange={(value) => change("date", value)}
      />
      <ChoiceField
        label="分类"
        value={draft.category}
        options={[...new Set([draft.category, ...categoryNames(ledger)])]
          .filter(Boolean)
          .map((value) => ({ value, label: value }))}
        onChange={(value) => change("category", value)}
      />
      <EntryMoneyFields form={form} ledger={ledger} />
      {["refund", "reimburse"].includes(draft.type) ? (
        <ChoiceField
          label="关联原支出"
          value={draft.relatedId}
          options={[
            {
              value: "",
              label: draft.type === "reimburse" ? "请选择原支出" : "不关联",
            },
            ...ledger.records
              .filter(
                (item) =>
                  item.kind === "支出" &&
                  !item.isDeleted &&
                  item.status === "confirmed",
              )
              .map((item) => ({
                value: item.id,
                label: `${item.date.slice(0, 10)} · ${item.merchant} · ¥${(item.amount / 100).toFixed(2)}`,
              })),
          ]}
          onChange={(value) => change("relatedId", value)}
        />
      ) : null}
      {draft.type === "expense" ? (
        <Checkbox.Item
          label="这笔支出需要报销"
          status={draft.isReimbursable ? "checked" : "unchecked"}
          onPress={() => change("isReimbursable", !draft.isReimbursable)}
        />
      ) : null}
      <EntrySplitFields form={form} members={members} />
      <TextInput
        label="备注"
        value={draft.description}
        multiline
        onChangeText={(value) => change("description", value)}
      />
      <TextInput
        label="标签（逗号分隔）"
        value={draft.tags}
        onChangeText={(value) => change("tags", value)}
      />
      <ErrorMessage message={form.error} />
      <Button
        mode="contained"
        loading={form.isBusy}
        disabled={form.isBusy}
        onPress={() => void form.save()}
      >
        保存完整交易
      </Button>
    </FormSheet>
  );
}
