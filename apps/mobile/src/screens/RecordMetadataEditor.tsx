import { useState } from "react";
import { Button, Checkbox, Text } from "react-native-paper";
import {
  categoryNames,
  KINDS,
  type BillRecord,
  type Kind,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
interface RecordMetadataEditorProps {
  record: BillRecord;
  controller: LedgerController;
  onClose: () => void;
}
export function RecordMetadataEditor({
  record,
  controller,
  onClose,
}: RecordMetadataEditorProps): React.JSX.Element {
  const [baseline] = useState(record);
  const [kind, setKind] = useState<Kind>(record.kind);
  const [category, setCategory] = useState(record.category);
  const [accountId, setAccountId] = useState(record.accountId ?? "");
  const [destination, setDestination] = useState(
    record.transferToAccountId ?? "",
  );
  const [shouldRemember, setShouldRemember] = useState(false);
  const [error, setError] = useState("");
  const accounts = controller.ledger.accounts
    .filter(
      (account) =>
        !account.isArchived ||
        account.id === accountId ||
        account.id === destination,
    )
    .map((account) => ({ value: account.id, label: account.name }));
  async function save(): Promise<void> {
    try {
      await controller.editRecord({
        id: baseline.id,
        expectedRecord: baseline,
        kind,
        category,
        account: baseline.account,
        accountId: accountId || null,
        transferToAccountId: kind === "转账" ? destination || null : null,
        remember: shouldRemember,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <FormSheet title="分类与账户" onClose={onClose}>
      <Text>{record.merchant} · 保留原始金额和日期</Text>
      <ChoiceField
        label="收支类型"
        value={kind}
        onChange={(value) => setKind(value as Kind)}
        options={KINDS.map((value) => ({ value, label: value }))}
      />
      <ChoiceField
        label="分类"
        value={category}
        onChange={setCategory}
        options={[
          ...new Set([
            baseline.category,
            ...categoryNames(controller.ledger, kind),
          ]),
        ].map((value) => ({ value, label: value }))}
      />
      <ChoiceField
        label="关联资产账户"
        value={accountId}
        onChange={setAccountId}
        options={[{ value: "", label: "不关联资产" }, ...accounts]}
      />
      {kind === "转账" ? (
        <ChoiceField
          label="转入账户"
          value={destination}
          onChange={setDestination}
          options={[
            { value: "", label: "请选择" },
            ...accounts.filter((account) => account.value !== accountId),
          ]}
        />
      ) : null}
      <Checkbox.Item
        label="记住此商户的分类"
        status={shouldRemember ? "checked" : "unchecked"}
        onPress={() => setShouldRemember(!shouldRemember)}
      />
      <ErrorMessage message={error} />
      <Button
        mode="contained"
        loading={controller.isSaving}
        disabled={controller.isSaving}
        onPress={() => void save()}
      >
        保存修改
      </Button>
    </FormSheet>
  );
}
