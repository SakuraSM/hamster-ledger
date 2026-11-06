import { useRef } from "react";
import { Button, Text, TextInput } from "react-native-paper";
import {
  formatCurrency,
  projectAccountBalance,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { useAdvancedEntry } from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { localNow, newEntityId } from "../platform/runtime";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
import { assetTransferDraft } from "./asset-actions";
import { repaymentPreview } from "./asset-repayment-preview";

interface AssetTransferProps {
  ledger: Ledger;
  account?: AssetAccount;
  isAmountHidden?: boolean;
  onSave: (ledger: Ledger) => Promise<void>;
  onClose: () => void;
}

function accountLabel({
  account,
  accounts,
  isAmountHidden,
}: {
  account: AssetAccount;
  accounts: AssetAccount[];
  isAmountHidden: boolean;
}): string {
  if (!isAmountHidden) return account.name;
  const index = accounts
    .filter((item) => item.kind === account.kind)
    .findIndex((item) => item.id === account.id);
  return `${account.kind === "asset" ? "资产账户" : "负债账户"} ${index + 1}`;
}

export function AssetTransfer({
  ledger,
  account,
  isAmountHidden = false,
  onSave,
  onClose,
}: AssetTransferProps): React.JSX.Element {
  const isRepayment = account?.kind === "liability";
  const form = useAdvancedEntry({
    ledger,
    initialDraft: assetTransferDraft(account),
    now: localNow(),
    newId: newEntityId,
    client: useNativeAccount().client,
    onSave,
    onClose,
  });
  const { draft, change, currency, destinationCurrency } = form;
  const initialDraft = useRef(draft);
  const hasUnsavedChanges =
    JSON.stringify(draft) !== JSON.stringify(initialDraft.current);
  const sources = ledger.accounts.filter(
    (item) => !item.isArchived && (!isRepayment || item.kind === "asset"),
  );
  const destinations = ledger.accounts.filter(
    (item) => !item.isArchived && item.id !== draft.accountId,
  );
  const currentAccount = ledger.accounts.find(
    (item) => item.id === account?.id,
  );
  const balance = currentAccount
    ? projectAccountBalance({
        ledger,
        account: currentAccount,
        through: draft.date,
      })
    : null;
  const balanceText =
    currentAccount && balance?.baseline
      ? isAmountHidden
        ? "••••"
        : formatCurrency({
            minor: Math.abs(balance.balance),
            currency: currentAccount.currency ?? "CNY",
          })
      : "尚无余额基准";
  const preview = repaymentPreview({
    ledger,
    account,
    draft,
    needsRateConfirmation: form.needsRateConfirmation,
  });
  const previewAmount = (minor: number): string =>
    isAmountHidden ? "••••" : formatCurrency({ minor, currency });
  return (
    <FormSheet
      title={isRepayment ? "记录还款" : "账户间转账"}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      <Text variant="headlineMedium" accessibilityRole="header">
        {isRepayment ? "记下一次还款" : "记录账户间转账"}
      </Text>
      {isRepayment ? (
        <Text>
          {isAmountHidden
            ? "当前账户余额"
            : balance?.balance !== undefined && balance.balance < 0
              ? "当前预存余额"
              : "当前剩余负债"}{" "}
          {balanceText}
        </Text>
      ) : null}
      <TextInput
        mode="outlined"
        label={`${isRepayment ? "还款金额" : "转出金额"}（${currency}）`}
        accessibilityLabel={`${isRepayment ? "还款金额" : "转出金额"}（${currency}）`}
        value={draft.amount}
        keyboardType="decimal-pad"
        onChangeText={(value) => change("amount", value)}
      />
      <ChoiceField
        label={isRepayment ? "付款资产账户" : "转出账户"}
        value={draft.accountId}
        options={[
          { value: "", label: "请选择" },
          ...sources.map((item) => ({
            value: item.id,
            label: `${accountLabel({ account: item, accounts: ledger.accounts, isAmountHidden })} · ${item.currency ?? "CNY"}`,
          })),
        ]}
        onChange={(value) => change("accountId", value)}
      />
      {!sources.length ? (
        <Text>
          {isRepayment ? "请先添加付款资产账户。" : "请先添加转出账户。"}
        </Text>
      ) : null}
      {isRepayment ? (
        <Text>
          还款负债账户：
          {accountLabel({
            account: currentAccount ?? account,
            accounts: ledger.accounts,
            isAmountHidden,
          })}
        </Text>
      ) : (
        <ChoiceField
          label="转入账户"
          value={draft.destinationId}
          options={[
            { value: "", label: "请选择" },
            ...destinations.map((item) => ({
              value: item.id,
              label: `${accountLabel({ account: item, accounts: ledger.accounts, isAmountHidden })} · ${item.currency ?? "CNY"}`,
            })),
          ]}
          onChange={(value) => change("destinationId", value)}
        />
      )}
      <DateField
        label={isRepayment ? "还款时间" : "转账时间"}
        value={draft.date}
        withTime
        onChange={(value) => change("date", value)}
      />
      {currency !== "CNY" ? (
        <>
          <TextInput
            label={`1 ${currency} 折合人民币`}
            value={draft.rate}
            keyboardType="decimal-pad"
            onChangeText={(value) => change("rate", value)}
          />
          <DateField
            label="实际汇率日期"
            value={draft.rateDate}
            onChange={(value) => change("rateDate", value)}
          />
          <Button
            contentStyle={{ minHeight: 48 }}
            loading={form.isBusy}
            onPress={() => void form.fetchRate()}
          >
            查询交易日参考汇率
          </Button>
          {form.quote ? (
            <Text>
              {form.quote.isCached ? "缓存参考汇率" : "Frankfurter 参考汇率"} ·{" "}
              {form.quote.date}
            </Text>
          ) : null}
          {form.needsRateConfirmation ? (
            <Button contentStyle={{ minHeight: 48 }} onPress={form.confirmRate}>
              确认使用此缓存汇率
            </Button>
          ) : null}
        </>
      ) : null}
      {destinationCurrency !== currency ? (
        <>
          <TextInput
            label={`实际转入金额（${destinationCurrency}）`}
            value={draft.destinationAmount}
            keyboardType="decimal-pad"
            onChangeText={(value) => change("destinationAmount", value)}
          />
          {destinationCurrency !== "CNY" ? (
            <TextInput
              label={`转入汇率：1 ${destinationCurrency} 折合人民币`}
              value={draft.destinationRate}
              keyboardType="decimal-pad"
              onChangeText={(value) => change("destinationRate", value)}
            />
          ) : null}
        </>
      ) : null}
      {preview && "message" in preview ? <Text>{preview.message}</Text> : null}
      {preview && "sourceBefore" in preview ? (
        <>
          <Text accessibilityRole="header">还款前后</Text>
          <Text>{`付款账户 · 还款前 ${previewAmount(preview.sourceBefore)} · 还款后 ${previewAmount(preview.sourceAfter)}`}</Text>
          <Text>{`负债账户 · 还款前 ${previewAmount(preview.targetBefore)} · 还款后 ${previewAmount(preview.targetAfter)}`}</Text>
          {!isAmountHidden ? (
            <Text>
              {currency === "CNY"
                ? "同币种还款，净资产不变。"
                : "同币种还款的原币净额不变，人民币估值可能受汇率和舍入影响。"}
            </Text>
          ) : null}
        </>
      ) : null}
      <Text>
        选择实际付款账户后，转账和还款只影响关联账户余额，不计作收入或支出。
      </Text>
      <ErrorMessage message={form.error} />
      <Button
        mode="contained"
        contentStyle={{ minHeight: 48 }}
        loading={form.isBusy}
        disabled={form.isBusy}
        onPress={() => void form.save()}
      >
        {isRepayment ? "确认记录还款" : "确认转账"}
      </Button>
    </FormSheet>
  );
}
