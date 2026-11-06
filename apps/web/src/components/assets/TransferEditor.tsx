import { Alert, Button, TextInput } from "@mantine/core";
import { type AssetAccount, type Ledger } from "@hamster-ledger/core";
import { useAdvancedEntry } from "@hamster-ledger/ledger-react";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { Dialog } from "../Dialog";
import { accountAmount, assetAccountLabel } from "./asset-format";
import { repaymentPreview } from "./repayment-preview";

const MINUTE_PRECISION_LENGTH = 16;

interface TransferEditorProps {
  ledger: Ledger;
  sourceId?: string;
  repaymentAccount?: AssetAccount;
  isHidden: boolean;
  onSave: (ledger: Ledger) => Promise<void>;
  onClose: () => void;
}

export function TransferEditor({
  ledger,
  sourceId,
  repaymentAccount,
  isHidden,
  onSave,
  onClose,
}: TransferEditorProps): React.JSX.Element {
  const now = localNow();
  const source = ledger.accounts.find((account) => account.id === sourceId);
  const form = useAdvancedEntry({
    ledger,
    initialDraft: {
      type: "transfer",
      accountId: sourceId ?? "",
      destinationId: repaymentAccount?.id ?? "",
      merchant: repaymentAccount
        ? repaymentAccount.type === "信用卡"
          ? "信用卡还款"
          : "负债还款"
        : "账户转账",
      rate: (source?.currency ?? "CNY") === "CNY" ? "1" : "",
    },
    now,
    newId: newEntityId,
    client: useNetworkClient(),
    onSave,
    onClose,
  });
  const { draft, change, currency, destinationCurrency } = form;
  const active = ledger.accounts.filter((account) => !account.isArchived);
  const sourceAccount = active.find(
    (account) => account.id === draft.accountId,
  );
  const targetAccount = active.find(
    (account) => account.id === draft.destinationId,
  );
  const { preview, isArchivedAtRepayment } = repaymentPreview({
    ledger,
    isRepayment: Boolean(repaymentAccount),
    sourceAccount,
    targetAccount,
    currency,
    destinationCurrency,
    draft,
    needsRateConfirmation: form.needsRateConfirmation,
  });
  const amount = (minor: number): string =>
    accountAmount({ minor, currency, isHidden });
  return (
    <Dialog
      title={
        repaymentAccount
          ? repaymentAccount.type === "信用卡"
            ? "记下一次信用卡还款"
            : "记录负债还款"
          : "账户间转账"
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.save();
        }}
      >
        <p className="account-form-help">
          {repaymentAccount
            ? "选择实际付款账户；还款作为账户间转账，不计入支出。"
            : "本金只影响账户余额，不计入收入或支出。手续费请另记。"}
        </p>
        <div className="form-grid asset-transfer-fields">
          <TextInput
            label={`${repaymentAccount ? "本次还款" : "转出金额"}（${currency}）`}
            required
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => change("amount", event.currentTarget.value)}
          />
          <Choice
            label={repaymentAccount ? "付款资产账户" : "转出账户"}
            value={draft.accountId}
            onChange={(value) => change("accountId", value)}
          >
            <option value="">请选择</option>
            {active
              .filter(
                (account) =>
                  account.id !== draft.destinationId &&
                  (!repaymentAccount || account.kind === "asset"),
              )
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {assetAccountLabel({
                    account,
                    accounts: ledger.accounts,
                    isHidden,
                  })}{" "}
                  · {account.currency ?? "CNY"}
                </option>
              ))}
          </Choice>
          <Choice
            label={repaymentAccount ? "还款负债账户" : "转入账户"}
            value={draft.destinationId}
            onChange={(value) => change("destinationId", value)}
            disabled={Boolean(repaymentAccount)}
          >
            <option value="">请选择</option>
            {active
              .filter((account) => account.id !== draft.accountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {assetAccountLabel({
                    account,
                    accounts: ledger.accounts,
                    isHidden,
                  })}{" "}
                  · {account.currency ?? "CNY"}
                </option>
              ))}
          </Choice>
          <DateField
            label={repaymentAccount ? "还款时间" : "转账时间"}
            type="datetime-local"
            value={draft.date.replace(" ", "T")}
            onChange={(value) =>
              change(
                "date",
                value.replace("T", " ") +
                  (value.length === MINUTE_PRECISION_LENGTH ? ":00" : ""),
              )
            }
            required
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
                  {form.quote.isCached ? "缓存参考汇率" : "参考汇率"} ·{" "}
                  {form.quote.date}
                  {form.needsRateConfirmation ? (
                    <Button variant="subtle" onClick={form.confirmRate}>
                      确认使用此缓存汇率
                    </Button>
                  ) : null}
                </Alert>
              ) : null}
            </>
          ) : null}
          {targetAccount && currency !== destinationCurrency ? (
            <>
              <TextInput
                label={`实际转入金额（${destinationCurrency}）`}
                required
                inputMode="decimal"
                value={draft.destinationAmount}
                onChange={(event) =>
                  change("destinationAmount", event.currentTarget.value)
                }
              />
              {destinationCurrency !== "CNY" ? (
                <TextInput
                  label={`转入汇率：1 ${destinationCurrency} 折合人民币`}
                  required
                  inputMode="decimal"
                  value={draft.destinationRate}
                  onChange={(event) =>
                    change("destinationRate", event.currentTarget.value)
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>
        {preview && sourceAccount && targetAccount ? (
          <p className="asset-transfer-preview" aria-live="polite">
            保存后：
            {assetAccountLabel({
              account: sourceAccount,
              accounts: ledger.accounts,
              isHidden,
            })}{" "}
            {amount(preview.sourceBalance)}，
            {assetAccountLabel({
              account: targetAccount,
              accounts: ledger.accounts,
              isHidden,
            })}
            {isHidden ? "余额" : preview.targetBalance < 0 ? "预存" : "负债"}{" "}
            {amount(Math.abs(preview.targetBalance))}
            {isHidden
              ? "。还款不计支出。"
              : currency === "CNY"
                ? "。同币种还款净资产不变，不计支出。"
                : "。原币净额不变，人民币估值可能受汇率和舍入影响，不计支出。"}
          </p>
        ) : (
          <p className="account-form-help">
            {isArchivedAtRepayment
              ? "还款时间有账户已归档，无法预览余额。"
              : "选择账户和金额后，可核对余额；缺少基准或跨币种时不预测净资产。"}
          </p>
        )}
        {form.error ? (
          <Alert color="red" role="alert">
            {form.error}
          </Alert>
        ) : null}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            className="primary-button"
            type="submit"
            loading={form.isBusy}
          >
            {repaymentAccount ? "确认记录还款" : "确认转账"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
