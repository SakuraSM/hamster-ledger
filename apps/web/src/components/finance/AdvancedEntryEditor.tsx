import { Alert, Button, Checkbox, TextInput, Textarea } from "@mantine/core";
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
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { Dialog } from "../Dialog";
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
  const client = useNetworkClient();
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
    <Dialog title={record ? "编辑完整交易" : "完整交易记账"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.save();
        }}
      >
        <div className="form-grid">
          <Choice
            label="交易类型"
            value={draft.type}
            onChange={(value) => change("type", value as typeof draft.type)}
          >
            {TRANSACTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {TRANSACTION_LABELS[value]}
              </option>
            ))}
          </Choice>
          <TextInput
            label="商户 / 交易名称"
            value={draft.merchant}
            required
            onChange={(event) => change("merchant", event.currentTarget.value)}
          />
          <DateField
            label="交易时间"
            type="datetime-local"
            value={draft.date.replace(" ", "T")}
            onChange={(value) =>
              change(
                "date",
                value.replace("T", " ") + (value.length === 16 ? ":00" : ""),
              )
            }
          />
          <Choice
            label="分类"
            value={draft.category}
            onChange={(value) => change("category", value)}
          >
            {[...new Set([draft.category, ...categoryNames(ledger)])]
              .filter(Boolean)
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </Choice>
          <EntryMoneyFields form={form} ledger={ledger} />
          {["refund", "reimburse"].includes(draft.type) ? (
            <Choice
              label="关联原支出"
              value={draft.relatedId}
              onChange={(value) => change("relatedId", value)}
            >
              <option value="">
                {draft.type === "reimburse" ? "请选择原支出" : "不关联"}
              </option>
              {ledger.records
                .filter(
                  (item) =>
                    item.kind === "支出" &&
                    !item.isDeleted &&
                    item.status === "confirmed",
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.date.slice(0, 10)} · {item.merchant} · ¥
                    {(item.amount / 100).toFixed(2)}
                  </option>
                ))}
            </Choice>
          ) : null}
          {draft.type === "expense" ? (
            <Checkbox
              label="这笔支出需要报销"
              checked={draft.isReimbursable}
              onChange={(event) =>
                change("isReimbursable", event.currentTarget.checked)
              }
            />
          ) : null}
          <Textarea
            className="full-width"
            label="备注"
            value={draft.description}
            onChange={(event) =>
              change("description", event.currentTarget.value)
            }
          />
          <TextInput
            label="标签（逗号分隔）"
            value={draft.tags}
            onChange={(event) => change("tags", event.currentTarget.value)}
          />
        </div>
        <EntrySplitFields form={form} members={members} />
        {form.error ? (
          <Alert color="red" role="alert">
            {form.error}
          </Alert>
        ) : null}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={form.isBusy}>
            保存完整交易
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
