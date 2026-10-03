import { TextInput, Textarea, Button } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { useState } from "react";
import {
  CURRENCIES,
  CURRENCY_DIGITS,
  parseMinor,
  type Currency,
  ASSET_TYPES,
  LIABILITY_TYPES,
  type AssetAccount,
  type AccountKind,
} from "@hamster-ledger/core";
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { Dialog } from "../Dialog";
export interface AccountSave {
  account: AssetAccount;
  note: string;
}
interface AccountEditorProps {
  account?: AssetAccount;
  currentBalance?: number;
  isCalibration?: boolean;
  onSave: (input: AccountSave) => Promise<void>;
  onClose: () => void;
}
const MINUTE_PRECISION_LENGTH = 16;
export function AccountEditor({
  account,
  currentBalance,
  isCalibration = false,
  onSave,
  onClose,
}: AccountEditorProps): React.JSX.Element {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "asset");
  const [type, setType] = useState<AssetAccount["type"]>(
    account?.type ?? "银行卡",
  );
  const [currency, setCurrency] = useState<Currency>(
    account?.currency ?? "CNY",
  );
  const [creditLimit, setCreditLimit] = useState(
    account?.creditLimit === undefined
      ? ""
      : String(account.creditLimit / 10 ** CURRENCY_DIGITS[currency]),
  );
  const [statementDay, setStatementDay] = useState(
    String(account?.statementDay ?? ""),
  );
  const [paymentDay, setPaymentDay] = useState(
    String(account?.paymentDay ?? ""),
  );
  const [balance, setBalance] = useState(
    String(
      (isCalibration ? (currentBalance ?? 0) : (account?.openingBalance ?? 0)) /
        10 ** CURRENCY_DIGITS[currency],
    ),
  );
  const [balanceAt, setBalanceAt] = useState(
    (isCalibration ? localNow() : (account?.balanceAt ?? localNow())).replace(
      " ",
      "T",
    ),
  );
  const [aliases, setAliases] = useState(account?.aliases.join("\n") ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const amount = parseMinor({ value: balance, currency });
      const timestamp = balanceAt.replace("T", " ");
      const normalizedAt =
        timestamp.length === MINUTE_PRECISION_LENGTH
          ? timestamp + ":00"
          : timestamp;
      await onSave({
        account: {
          id: account?.id ?? newEntityId(),
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
          balanceAt: normalizedAt,
          aliases: aliases
            .split(/[\n，,]/)
            .map((alias) => alias.trim())
            .filter(Boolean),
          isArchived: account?.isArchived ?? false,
          checkpoints: account?.checkpoints ?? [],
        },
        note,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户保存失败。");
    } finally {
      setIsSaving(false);
    }
  }
  const types = kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES;
  return (
    <Dialog
      title={
        isCalibration
          ? "校准账户余额"
          : account
            ? "编辑资产账户"
            : "添加资产账户"
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <TextInput
            label={<>账户名称</>}
            className="full-width"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="如：招商银行 · 6628、现金、房贷"
          />
          <Choice
            label={<>账户性质</>}
            value={kind}
            disabled={!!account}
            onChange={(value) => {
              const next = value as AccountKind;
              setKind(next);
              setType(next === "asset" ? "银行卡" : "信用卡");
            }}
          >
            <option value="asset">资产账户</option>
            <option value="liability">负债账户</option>
          </Choice>
          <Choice
            label={<>账户类型</>}
            value={type}
            onChange={(value) => setType(value as AssetAccount["type"])}
          >
            {types.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Choice>
          <Choice
            label="账户币种"
            value={currency}
            disabled={Boolean(account)}
            onChange={(value) => setCurrency(value as Currency)}
          >
            {CURRENCIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Choice>
          {type === "信用卡" ? (
            <>
              <TextInput
                label={`信用额度（${currency}）`}
                value={creditLimit}
                onChange={(event) => setCreditLimit(event.currentTarget.value)}
                inputMode="decimal"
              />
              <TextInput
                label="账单日（1–31）"
                value={statementDay}
                onChange={(event) => setStatementDay(event.currentTarget.value)}
                inputMode="numeric"
              />
              <TextInput
                label="还款日（1–31）"
                value={paymentDay}
                onChange={(event) => setPaymentDay(event.currentTarget.value)}
                inputMode="numeric"
              />
            </>
          ) : null}
          <TextInput
            label={
              <>
                {kind === "asset"
                  ? `基准余额（${currency}）`
                  : `基准负债（${currency}）`}
              </>
            }
            required
            inputMode="decimal"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder="0.00"
          />
          <DateField
            label={<>余额确认时间</>}
            required
            type="datetime-local"

            value={balanceAt}
            onChange={(value) => setBalanceAt(value)}
          />
          <Textarea
            label={<>账单账户别名</>}
            className="full-width"
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            rows={3}
            placeholder="每行一个，如：招商银行 · 6628\n用于匹配导入账单的实际付款账户"
          />
          <TextInput
            label={<>余额维护说明</>}
            className="full-width"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="如：核对银行余额、更新投资估值"
          />
        </div>
        <p className="account-form-help">
          只累计余额确认时间之后的已确认流水。过去的工资、支出不会再次叠加到你填写的当前余额中。负债按正数填写，信用卡预存余额可填负数。
        </p>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <Button
            variant="outline"
            className="secondary-button"
            type="button"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            variant="filled"
            className="primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "保存中…" : "保存账户"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
