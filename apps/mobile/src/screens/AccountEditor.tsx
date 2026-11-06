import { useRef, useState } from "react";
import { Button, TextInput, Text } from "react-native-paper";
import {
  CURRENCIES,
  CURRENCY_DIGITS,
  parseMinor,
  type Currency,
  ASSET_TYPES,
  LIABILITY_TYPES,
  saveAssetAccount,
  type AssetAccount,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
import { localNow, newEntityId } from "../platform/runtime";
import { assetBookKey, assetCommitOptions } from "./asset-archive";
const DECIMAL_BASE = 10;

function snapshotAccount(account?: AssetAccount): AssetAccount | null {
  if (!account) return null;
  return {
    ...account,
    aliases: [...account.aliases],
    checkpoints: account.checkpoints.map((checkpoint) => ({ ...checkpoint })),
    ...(account.archiveHistory
      ? {
          archiveHistory: account.archiveHistory.map((event) => ({ ...event })),
        }
      : {}),
  };
}
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
  const [expectedAccount] = useState(() => snapshotAccount(account));
  const [accountId] = useState(() => account?.id ?? newEntityId());
  const [expectedBookKey] = useState(() => assetBookKey(controller));
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AssetAccount["kind"]>(
    account?.kind ?? "asset",
  );
  const [type, setType] = useState(account?.type ?? "银行卡");
  const [currency, setCurrency] = useState<Currency>(
    account?.currency ?? "CNY",
  );
  const [creditLimit, setCreditLimit] = useState(
    account?.creditLimit === undefined
      ? ""
      : String(account.creditLimit / DECIMAL_BASE ** CURRENCY_DIGITS[currency]),
  );
  const [statementDay, setStatementDay] = useState(
    String(account?.statementDay ?? ""),
  );
  const [paymentDay, setPaymentDay] = useState(
    String(account?.paymentDay ?? ""),
  );
  const [balance, setBalance] = useState(
    account
      ? String(
          account.openingBalance / DECIMAL_BASE ** CURRENCY_DIGITS[currency],
        )
      : "",
  );
  const [balanceAt, setBalanceAt] = useState(account?.balanceAt ?? localNow());
  const [aliases, setAliases] = useState(account?.aliases.join("，") ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const initial = useRef({
    name,
    kind,
    type,
    currency,
    creditLimit,
    statementDay,
    paymentDay,
    balance,
    balanceAt,
    aliases,
    note,
  });
  const hasUnsavedChanges = Object.entries({
    name,
    kind,
    type,
    currency,
    creditLimit,
    statementDay,
    paymentDay,
    balance,
    balanceAt,
    aliases,
    note,
  }).some(
    ([key, value]) =>
      initial.current[key as keyof typeof initial.current] !== value,
  );
  async function save(): Promise<void> {
    try {
      if ((account?.id ?? null) !== (expectedAccount?.id ?? null))
        throw new Error("账户已切换，请重新打开后再保存。");
      if (assetBookKey(controller) !== expectedBookKey)
        throw new Error("账本已切换，请重新打开账户后再保存。");
      if (!balance.trim()) throw new Error("请输入账户基准余额，可填写 0。");
      const amount = parseMinor({ value: balance, currency });
      const options = assetCommitOptions(controller);
      const next = saveAssetAccount({
        ledger: controller.ledger,
        expectedAccount,
        account: {
          ...expectedAccount,
          id: accountId,
          name,
          kind,
          type,
          currency,
          creditLimit:
            type === "信用卡" && creditLimit
              ? parseMinor({ value: creditLimit, currency })
              : undefined,
          statementDay:
            type === "信用卡" && statementDay
              ? Number(statementDay)
              : undefined,
          paymentDay:
            type === "信用卡" && paymentDay ? Number(paymentDay) : undefined,
          openingBalance: amount,
          balanceAt,
          aliases: aliases
            .split(/[，,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          isArchived: expectedAccount?.isArchived ?? false,
          checkpoints: expectedAccount?.checkpoints ?? [],
        },
        now: localNow(),
        checkpointId: newEntityId(),
        note,
      });
      if (options) await controller.commit(next, options);
      else await controller.commit(next);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户保存失败");
    }
  }
  return (
    <FormSheet
      title={account ? "编辑账户" : "添加账户"}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
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
      <ChoiceField
        label="账户币种"
        value={currency}
        disabled={Boolean(account)}
        options={CURRENCIES.map((value) => ({ value, label: value }))}
        onChange={(value) => setCurrency(value as Currency)}
      />
      {type === "信用卡" ? (
        <>
          <TextInput
            label={`信用额度（${currency}）`}
            value={creditLimit}
            onChangeText={setCreditLimit}
            keyboardType="decimal-pad"
          />
          <TextInput
            label="账单日（1–31）"
            value={statementDay}
            onChangeText={setStatementDay}
            keyboardType="number-pad"
          />
          <TextInput
            label="还款日（1–31）"
            value={paymentDay}
            onChangeText={setPaymentDay}
            keyboardType="number-pad"
          />
        </>
      ) : null}
      <Text variant="titleMedium">设定余额基准</Text>
      <TextInput
        accessibilityLabel={
          kind === "asset"
            ? `基准余额（${currency}）`
            : `基准负债（${currency}）`
        }
        mode="outlined"
        label={
          kind === "asset"
            ? `基准余额（${currency}）`
            : `基准负债（${currency}）`
        }
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
        contentStyle={{ minHeight: 48 }}
        onPress={() => void save()}
      >
        保存账户
      </Button>
    </FormSheet>
  );
}
