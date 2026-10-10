import { Alert, Button, TextInput } from "@mantine/core";
import {
  TWO_ACCOUNT_TYPES,
  type AdvancedEntryController,
} from "@hamster-ledger/ledger-react";
import type { Ledger } from "@hamster-ledger/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
export function EntryMoneyFields({
  form,
  ledger,
}: {
  form: AdvancedEntryController;
  ledger: Ledger;
}): React.JSX.Element {
  const { draft, change, currency, destinationCurrency } = form;
  const accounts = ledger.accounts.filter((item) => !item.isArchived);
  return (
    <>
      <Choice
        label="收付款账户"
        value={draft.accountId}
        onChange={(value) => change("accountId", value)}
      >
        <option value="">请选择</option>
        {accounts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} · {item.currency ?? "CNY"}
          </option>
        ))}
      </Choice>
      <TextInput
        label={`原币金额（${currency}）`}
        required
        inputMode="decimal"
        value={draft.amount}
        onChange={(event) => change("amount", event.currentTarget.value)}
      />
      {currency !== "CNY" ? (
        <>
          <TextInput
            label={`1 ${currency} 折合人民币`}
            required
            inputMode="decimal"
            value={draft.rate}
            onChange={(event) => change("rate", event.currentTarget.value)}
          />
          <DateField
            label="实际汇率日期"
            type="date"
            value={draft.rateDate}
            onChange={(value) => change("rateDate", value)}
          />
          <Button
            variant="outline"
            loading={form.isBusy}
            onClick={() => void form.fetchRate()}
          >
            查询交易日参考汇率
          </Button>
          {form.quote ? (
            <Alert>
              {form.quote.isCached ? "缓存参考汇率" : "Frankfurter 参考汇率"} ·{" "}
              {form.quote.date}。历史流水保留此次汇率。
              {form.needsRateConfirmation ? (
                <Button variant="subtle" onClick={form.confirmRate}>
                  确认使用此缓存汇率
                </Button>
              ) : null}
            </Alert>
          ) : null}
        </>
      ) : null}
      {TWO_ACCOUNT_TYPES.includes(draft.type) ? (
        <>
          <Choice
            label="转入账户"
            value={draft.destinationId}
            onChange={(value) => change("destinationId", value)}
          >
            <option value="">请选择</option>
            {accounts
              .filter((item) => item.id !== draft.accountId)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.currency ?? "CNY"}
                </option>
              ))}
          </Choice>
          <TextInput
            label={`实际转入金额（${destinationCurrency}）`}
            placeholder={
              currency === destinationCurrency
                ? "留空时与转出金额一致"
                : "请填写实际到账金额"
            }
            value={draft.destinationAmount}
            inputMode="decimal"
            onChange={(event) =>
              change("destinationAmount", event.currentTarget.value)
            }
          />
          {destinationCurrency !== currency && destinationCurrency !== "CNY" ? (
            <TextInput
              label={`转入汇率：1 ${destinationCurrency} 折合人民币`}
              required
              value={draft.destinationRate}
              inputMode="decimal"
              onChange={(event) =>
                change("destinationRate", event.currentTarget.value)
              }
            />
          ) : null}
          <p className="muted">
            本金只影响账户余额；手续费请另记一笔「手续费」。AA
            结算不重复计入家庭收支。
          </p>
        </>
      ) : null}
      {draft.type === "adjust" ? (
        <Choice
          label="余额调整方向"
          value={String(draft.adjustmentSign)}
          onChange={(value) =>
            change("adjustmentSign", value === "-1" ? -1 : 1)
          }
        >
          <option value="1">资金增加（资产增加 / 负债减少）</option>
          <option value="-1">资金减少（资产减少 / 负债增加）</option>
        </Choice>
      ) : null}
    </>
  );
}
