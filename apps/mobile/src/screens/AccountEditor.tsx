import { CENTS_PER_YUAN } from "../constants";
import { useState } from "react";
import { Button, TextInput, Text } from "react-native-paper";
import {
  ASSET_TYPES,
  LIABILITY_TYPES,
  saveAssetAccount,
  type AssetAccount,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
import { localNow, newEntityId } from "../platform/runtime";
interface AccountEditorProps {
  account?: AssetAccount;
  controller: LedgerController;
  onClose: () => void;
}
export function AccountEditor({
  account,
  controller,
  onClose,
}: AccountEditorProps): React.JSX.Element {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AssetAccount["kind"]>(
    account?.kind ?? "asset",
  );
  const [type, setType] = useState(account?.type ?? "银行卡");
  const [balance, setBalance] = useState(
    account ? String(account.openingBalance / CENTS_PER_YUAN) : "0",
  );
  const [balanceAt, setBalanceAt] = useState(account?.balanceAt ?? localNow());
  const [aliases, setAliases] = useState(account?.aliases.join("，") ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  async function save(): Promise<void> {
    const amount = parseAmount(balance);
    if (amount === null) {
      setError("请填写有效的余额，最多两位小数。");
      return;
    }
    try {
      await controller.commit(
        saveAssetAccount({
          ledger: controller.ledger,
          account: {
            ...account,
            id: account?.id ?? newEntityId(),
            name,
            kind,
            type,
            openingBalance: amount,
            balanceAt,
            aliases: aliases
              .split(/[，,]/)
              .map((value) => value.trim())
              .filter(Boolean),
            isArchived: account?.isArchived ?? false,
            checkpoints: account?.checkpoints ?? [],
          },
          now: localNow(),
          checkpointId: newEntityId(),
          note,
        }),
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户保存失败");
    }
  }
  return (
    <FormSheet
      title={account ? "编辑账户 / 校准余额" : "添加资产账户"}
      onClose={onClose}
    >
      <TextInput
        accessibilityLabel="账户名称"
        mode="outlined"
        label="账户名称"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <ChoiceField
        label="账户性质"
        value={kind}
        disabled={Boolean(account)}
        options={[
          { value: "asset", label: "资产账户" },
          { value: "liability", label: "负债账户" },
        ]}
        onChange={(value) => {
          const next = value as AssetAccount["kind"];
          setKind(next);
          setType(next === "asset" ? "银行卡" : "信用卡");
        }}
      />
      <ChoiceField
        label="账户类别"
        value={type}
        options={(kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES).map(
          (value) => ({ value, label: value }),
        )}
        onChange={(value) => setType(value as AssetAccount["type"])}
      />
      <TextInput
        accessibilityLabel={
          kind === "asset" ? "基准余额（元）" : "基准负债（元）"
        }
        mode="outlined"
        label={kind === "asset" ? "基准余额（元）" : "基准负债（元）"}
        value={balance}
        keyboardType="decimal-pad"
        onChangeText={setBalance}
      />
      <DateField
        label="余额确认时间"
        value={balanceAt}
        onChange={setBalanceAt}
        withTime
      />
      <Text>
        只计算余额确认时间之后已确认的关联流水。校准后会保留原来的余额记录。
      </Text>
      <TextInput
        accessibilityLabel="账单账户别名（逗号分隔）"
        mode="outlined"
        label="账单账户别名（逗号分隔）"
        value={aliases}
        onChangeText={setAliases}
      />
      <TextInput
        accessibilityLabel="校准说明"
        mode="outlined"
        label="校准说明"
        value={note}
        onChangeText={setNote}
      />
      <ErrorMessage message={error} />
      <Button
        mode="contained"
        loading={controller.isSaving}
        disabled={controller.isSaving}
        onPress={() => void save()}
      >
        保存账户
      </Button>
    </FormSheet>
  );
}
