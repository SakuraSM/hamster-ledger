import { CENTS_PER_YUAN, DATE_KEY_LENGTH } from "../constants";
import { useState } from "react";
import { Button, TextInput, Text } from "react-native-paper";
import {
  defaultCategory,
  categoryNames,
  saveRecurring,
  type RecurringRule,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { FormSheet } from "../ui/FormSheet";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { ErrorMessage } from "../ui/Screen";
import { localNow, newEntityId } from "../platform/runtime";
interface RecurringEditorProps {
  controller: LedgerController;
  rule?: RecurringRule;
  onClose: () => void;
}
export function RecurringEditor({
  controller,
  rule,
  onClose,
}: RecurringEditorProps): React.JSX.Element {
  const [name, setName] = useState(rule?.name ?? "");
  const [merchant, setMerchant] = useState(rule?.merchant ?? "");
  const [amount, setAmount] = useState(
    rule ? String(rule.amount / CENTS_PER_YUAN) : "",
  );
  const [kind, setKind] = useState<RecurringRule["kind"]>(rule?.kind ?? "支出");
  const [category, setCategory] = useState(
    rule?.category ??
      defaultCategory(controller.ledger, {
        kind: "支出",
        preferredId: "builtin:居住",
      }),
  );
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>(
    rule?.frequency ?? "monthly",
  );
  const [startDate, setStartDate] = useState(
    rule?.startDate ?? localNow().slice(0, DATE_KEY_LENGTH),
  );
  const [endDate, setEndDate] = useState(rule?.endDate ?? "");
  const [accountId, setAccountId] = useState(rule?.accountId ?? "");
  const [destination, setDestination] = useState(
    rule?.transferToAccountId ?? "",
  );
  const [description, setDescription] = useState(rule?.description ?? "");
  const [error, setError] = useState("");
  const accounts = controller.ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => ({ value: account.id, label: account.name }));
  async function save(): Promise<void> {
    const cents = parseAmount(amount);
    if (cents === null || cents <= 0) {
      setError("请填写大于零的金额。");
      return;
    }
    if (!categoryNames(controller.ledger, kind).includes(category)) {
      setError("请选择可用分类。");
      return;
    }
    try {
      await controller.commit(
        saveRecurring(controller.ledger, {
          id: rule?.id ?? newEntityId(),
          name: name.trim(),
          merchant: merchant.trim(),
          amount: cents,
          kind,
          category,
          frequency,
          startDate,
          endDate,
          accountId: accountId || null,
          transferToAccountId: destination || null,
          description,
          tags: rule?.tags ?? [],
          isPaused: rule?.isPaused ?? false,
        }),
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <FormSheet title={rule ? "编辑周期规则" : "新增周期规则"} onClose={onClose}>
      <TextInput
        accessibilityLabel="规则名称"
        mode="outlined"
        label="规则名称"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        accessibilityLabel="商户 / 交易名称"
        mode="outlined"
        label="商户 / 交易名称"
        value={merchant}
        onChangeText={setMerchant}
      />
      <TextInput
        accessibilityLabel="金额（元）"
        mode="outlined"
        label="金额（元）"
        value={amount}
        keyboardType="decimal-pad"
        onChangeText={setAmount}
      />
      <ChoiceField
        label="收支类型"
        value={kind}
        options={["支出", "收入", "转账"].map((value) => ({
          value,
          label: value,
        }))}
        onChange={(value) => {
          const next = value as RecurringRule["kind"];
          setKind(next);
          setCategory(defaultCategory(controller.ledger, { kind: next }));
        }}
      />
      <ChoiceField
        label="分类"
        value={category}
        options={categoryNames(controller.ledger, kind).map((value) => ({
          value,
          label: value,
        }))}
        onChange={setCategory}
      />
      <ChoiceField
        label="频率"
        value={frequency}
        options={[
          { value: "daily", label: "每天" },
          { value: "weekly", label: "每周" },
          { value: "monthly", label: "每月" },
          { value: "yearly", label: "每年" },
        ]}
        onChange={(value) => setFrequency(value as RecurringRule["frequency"])}
      />
      <DateField label="开始日期" value={startDate} onChange={setStartDate} />
      <DateField
        label="结束日期（可选）"
        value={endDate}
        onChange={setEndDate}
      />
      {endDate ? (
        <Button onPress={() => setEndDate("")}>不设结束日期</Button>
      ) : null}
      <ChoiceField
        label="付款账户"
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
      />
      <Text>打开账本时自动补齐到期账单，月末与闰年沿用账本规则。</Text>
      <ErrorMessage message={error} />
      <Button
        mode="contained"
        disabled={controller.isSaving}
        loading={controller.isSaving}
        onPress={() => void save()}
      >
        保存规则
      </Button>
    </FormSheet>
  );
}
