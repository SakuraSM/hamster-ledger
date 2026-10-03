import type { EntryDraft } from "@hamster-ledger/ledger-react";
import { CENTS_PER_YUAN } from "../constants";
import { useState } from "react";
import { Button, SegmentedButtons, TextInput, Text } from "react-native-paper";
import {
  categoryNames,
  defaultCategory,
  resolveAssetAccount,
  type Ledger,
  type BillRecord,
  type Kind,
  type EntryInput,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import { localNow, newEntityId } from "../platform/runtime";
import { FormSheet } from "../ui/FormSheet";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { ErrorMessage } from "../ui/Screen";
export interface EntryEditorProps {
  onAdvanced?: (draft: Partial<EntryDraft>) => void;
  ledger: Ledger;
  record?: BillRecord;
  date?: string;
  onClose: () => void;
  onSave: (input: EntryInput) => Promise<void>;
}
export function SimpleEntryEditor({
  onAdvanced,
  ledger,
  record,
  date,
  onClose,
  onSave,
}: EntryEditorProps): React.JSX.Element {
  const [baseline] = useState(record);
  const [kind, setKind] = useState<Kind>(record?.kind ?? "支出");
  const [amount, setAmount] = useState(
    record ? String(record.amount / CENTS_PER_YUAN) : "",
  );
  const [merchant, setMerchant] = useState(record?.merchant ?? "");
  const [timestamp, setTimestamp] = useState(
    record?.date ?? (date ? date + " 12:00:00" : localNow()),
  );
  const [category, setCategory] = useState(
    record?.category ?? defaultCategory(ledger, { kind }),
  );
  const [accountId, setAccountId] = useState(
    record ? (resolveAssetAccount(record, ledger.accounts)?.id ?? "") : "",
  );
  const [destination, setDestination] = useState(
    record?.transferToAccountId ?? "",
  );
  const [description, setDescription] = useState(record?.description ?? "");
  const [tags, setTags] = useState(record?.tags?.join("，") ?? "");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = {
    amount,
    merchant,
    kind,
    timestamp,
    category,
    accountId,
    destination,
    description,
    tags,
  };
  const [initialDraft] = useState(draft);
  const accounts = ledger.accounts
    .filter(
      (account) => !account.isArchived && (account.currency ?? "CNY") === "CNY",
    )
    .map((account) => ({ value: account.id, label: account.name }));
  async function save(): Promise<void> {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError("请填写大于零的金额。");
      return;
    }
    if (!merchant.trim()) {
      setError("请填写商户或交易名称。");
      return;
    }
    if (
      !categoryNames(ledger, kind).includes(category) &&
      !(baseline?.category === category && baseline.kind === kind)
    ) {
      setError("分类已变更，请重新选择。");
      return;
    }
    setIsBusy(true);
    try {
      await onSave({
        id: baseline?.id ?? newEntityId(),
        expectedRecord: baseline,
        amount: cents,
        merchant,
        date: timestamp,
        kind,
        category,
        description,
        tags: tags
          .split(/[，,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        accountId: accountId || null,
        transferToAccountId: destination || null,
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存失败，草稿已保留。",
      );
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <FormSheet
      hasUnsavedChanges={JSON.stringify(draft) !== JSON.stringify(initialDraft)}
      title={record ? "编辑账单" : "记一笔"}
      onClose={onClose}
    >
      <Button
        onPress={() =>
          onAdvanced?.({
            amount,
            merchant,
            date:
              timestamp.replace("T", " ") +
              (timestamp.length === 16 ? ":00" : ""),
            category,
            description,
            tags,
            accountId,
            destinationId: destination,
            type:
              kind === "收入"
                ? "income"
                : kind === "退款"
                  ? "refund"
                  : kind === "转账"
                    ? "transfer"
                    : "expense",
          })
        }
      >
        更多交易类型 / 多币种 / AA 分摊
      </Button>
      <SegmentedButtons
        value={kind}
        onValueChange={(value) => {
          const next = value as Kind;
          setKind(next);
          if (!categoryNames(ledger, next).includes(category))
            setCategory(defaultCategory(ledger, { kind: next }));
        }}
        buttons={["支出", "收入", "转账", "退款"].map((value) => ({
          value,
          label: value,
        }))}
      />
      <TextInput
        accessibilityLabel="金额（元）"
        mode="outlined"
        label="金额（元）"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
        selectTextOnFocus
      />
      <TextInput
        accessibilityLabel="商户 / 交易名称"
        mode="outlined"
        label="商户 / 交易名称"
        value={merchant}
        onChangeText={setMerchant}
        maxLength={200}
      />
      <ChoiceField
        label="分类"
        value={category}
        options={[
          ...new Set([
            ...(baseline?.kind === kind ? [baseline.category] : []),
            ...categoryNames(ledger, kind),
          ]),
        ].map((value) => ({ value, label: value }))}
        onChange={setCategory}
      />
      <DateField
        label="交易时间"
        value={timestamp}
        onChange={setTimestamp}
        withTime
      />
      <ChoiceField
        label="收付款账户"
        value={accountId}
        options={[{ value: "", label: "不关联资产" }, ...accounts]}
        onChange={setAccountId}
      />
      {kind === "转账" ? (
        <ChoiceField
          label="转入账户"
          value={destination}
          options={[
            { value: "", label: "请选择" },
            ...accounts.filter((account) => account.value !== accountId),
          ]}
          onChange={setDestination}
        />
      ) : null}
      <TextInput
        accessibilityLabel="备注"
        mode="outlined"
        label="备注"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput
        accessibilityLabel="标签（逗号分隔）"
        mode="outlined"
        label="标签（逗号分隔）"
        value={tags}
        onChangeText={setTags}
      />
      <ErrorMessage message={error} />
      {record?.status === "pending" ? (
        <Text>这笔账单仍需重复核对，保存不会自动计入收支。</Text>
      ) : null}
      <Button
        mode="contained"
        loading={isBusy}
        disabled={isBusy}
        onPress={() => void save()}
      >
        保存账单
      </Button>
    </FormSheet>
  );
}
