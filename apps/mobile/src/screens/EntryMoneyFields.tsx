import { Button, Text, TextInput } from "react-native-paper";
import {
  TWO_ACCOUNT_TYPES,
  type AdvancedEntryController,
} from "@hamster-ledger/ledger-react";
import type { Ledger } from "@hamster-ledger/core";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
export function EntryMoneyFields({
  form,
  ledger,
}: {
  form: AdvancedEntryController;
  ledger: Ledger;
}): React.JSX.Element {
  const { draft, change, currency, destinationCurrency } = form;
  const accounts = ledger.accounts
    .filter((item) => !item.isArchived)
    .map((item) => ({
      value: item.id,
      label: `${item.name} · ${item.currency ?? "CNY"}`,
    }));
  return (
    <>
      <ChoiceField
        label="收付款账户"
        value={draft.accountId}
        options={[{ value: "", label: "请选择" }, ...accounts]}
        onChange={(value) => change("accountId", value)}
      />
      <TextInput
        label={`原币金额（${currency}）`}
        value={draft.amount}
        keyboardType="decimal-pad"
        onChangeText={(value) => change("amount", value)}
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
          <Button loading={form.isBusy} onPress={() => void form.fetchRate()}>
            查询交易日参考汇率
          </Button>
          {form.quote ? (
            <Text>
              {form.quote.isCached ? "缓存参考汇率" : "Frankfurter 参考汇率"} ·{" "}
              {form.quote.date}
            </Text>
          ) : null}
          {form.needsRateConfirmation ? (
            <Button onPress={form.confirmRate}>确认使用此缓存汇率</Button>
          ) : null}
        </>
      ) : null}
      {TWO_ACCOUNT_TYPES.includes(draft.type) ? (
        <>
          <ChoiceField
            label="转入账户"
            value={draft.destinationId}
            options={[
              { value: "", label: "请选择" },
              ...accounts.filter((item) => item.value !== draft.accountId),
            ]}
            onChange={(value) => change("destinationId", value)}
          />
          <TextInput
            label={`实际转入金额（${destinationCurrency}）`}
            placeholder={
              currency === destinationCurrency
                ? "留空时与转出一致"
                : "请填写实际到账金额"
            }
            value={draft.destinationAmount}
            keyboardType="decimal-pad"
            onChangeText={(value) => change("destinationAmount", value)}
          />
          {destinationCurrency !== currency && destinationCurrency !== "CNY" ? (
            <TextInput
              label={`转入汇率：1 ${destinationCurrency} 折合人民币`}
              value={draft.destinationRate}
              keyboardType="decimal-pad"
              onChangeText={(value) => change("destinationRate", value)}
            />
          ) : null}
          <Text>本金只影响余额。手续费单列。AA 结算不重复计入收支。</Text>
        </>
      ) : null}
      {draft.type === "adjust" ? (
        <ChoiceField
          label="余额调整方向"
          value={String(draft.adjustmentSign)}
          options={[
            { value: "1", label: "资金增加（资产增加 / 负债减少）" },
            { value: "-1", label: "资金减少（资产减少 / 负债增加）" },
          ]}
          onChange={(value) =>
            change("adjustmentSign", value === "-1" ? -1 : 1)
          }
        />
      ) : null}
    </>
  );
}
