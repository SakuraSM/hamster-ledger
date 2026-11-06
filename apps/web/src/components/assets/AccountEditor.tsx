const DECIMAL_BASE = 10;
import { TextInput, Textarea, Button } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { useEffect, useState } from "react";
import {
  CURRENCIES,
  CURRENCY_DIGITS,
  parseMinor,
  type Currency,
  ASSET_TYPES,
  LIABILITY_TYPES,
  type AssetAccount,
  type AccountKind,
  type LedgerMode,
} from "@hamster-ledger/core";
import { localNow, newEntityId } from "../../platform/browser/runtime";
import { Dialog } from "../Dialog";
export interface AssetBookContext {
  mode: LedgerMode;
  cloud: { id: string; userId: string; server: string } | null;
  isNetwork: boolean;
  revision?: number;
}
export function snapshotAssetBook(
  context?: AssetBookContext,
): AssetBookContext | undefined {
  return context
    ? { ...context, cloud: context.cloud ? { ...context.cloud } : null }
    : undefined;
}
export function isSameAssetBook(
  first?: AssetBookContext,
  second?: AssetBookContext,
): boolean {
  if (!first || !second) return first === second;
  return (
    first.mode === second.mode &&
    first.isNetwork === second.isNetwork &&
    first.cloud?.id === second.cloud?.id &&
    first.cloud?.userId === second.cloud?.userId &&
    first.cloud?.server === second.cloud?.server
  );
}
export interface AccountSave {
  account: AssetAccount;
  note: string;
  expectedAccount?: AssetAccount | null;
  expectedBook?: AssetBookContext;
  previewGuard?: AssetBookContext;
}
interface AccountEditorProps {
  account?: AssetAccount;
  bookContext?: AssetBookContext;
  isHidden?: boolean;
  onSave: (input: AccountSave) => Promise<void>;
  onClose: () => void;
}
const MINUTE_PRECISION_LENGTH = 16;

function snapshotAccount(account: AssetAccount): AssetAccount {
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

export function AccountEditor({
  account,
  bookContext,
  isHidden = false,
  onSave,
  onClose,
}: AccountEditorProps): React.JSX.Element {
  const [expectedAccount] = useState(() =>
    account ? snapshotAccount(account) : null,
  );
  const [expectedBook] = useState(() => snapshotAssetBook(bookContext));
  const [hasBookChanged, setHasBookChanged] = useState(false);
  const isBookMismatch = !isSameAssetBook(expectedBook, bookContext);
  useEffect(() => {
    if (isBookMismatch) setHasBookChanged(true);
  }, [isBookMismatch]);
  const isDifferentBook = hasBookChanged || isBookMismatch;
  const isDifferentAccount =
    (account?.id ?? null) !== (expectedAccount?.id ?? null);
  const [name, setName] = useState(expectedAccount?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(
    expectedAccount?.kind ?? "asset",
  );
  const [type, setType] = useState<AssetAccount["type"]>(
    expectedAccount?.type ?? "银行卡",
  );
  const [currency, setCurrency] = useState<Currency>(
    expectedAccount?.currency ?? "CNY",
  );
  const [creditLimit, setCreditLimit] = useState(
    expectedAccount?.creditLimit === undefined
      ? ""
      : String(
          expectedAccount.creditLimit /
            DECIMAL_BASE ** CURRENCY_DIGITS[currency],
        ),
  );
  const [statementDay, setStatementDay] = useState(
    String(expectedAccount?.statementDay ?? ""),
  );
  const [paymentDay, setPaymentDay] = useState(
    String(expectedAccount?.paymentDay ?? ""),
  );
  const [balance, setBalance] = useState(
    expectedAccount
      ? String(
          expectedAccount.openingBalance /
            DECIMAL_BASE ** CURRENCY_DIGITS[currency],
        )
      : "",
  );
  const [balanceAt, setBalanceAt] = useState(
    (expectedAccount?.balanceAt ?? localNow()).replace(" ", "T"),
  );
  const [aliases, setAliases] = useState(
    expectedAccount?.aliases.join("\n") ?? "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (isDifferentAccount || isDifferentBook) return;
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
          id: expectedAccount?.id ?? newEntityId(),
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
          isArchived: expectedAccount?.isArchived ?? false,
          archiveHistory: expectedAccount?.archiveHistory?.map((event) => ({
            ...event,
          })),
          checkpoints:
            expectedAccount?.checkpoints.map((checkpoint) => ({
              ...checkpoint,
            })) ?? [],
        },
        note,
        expectedAccount,
        ...(expectedBook ? { expectedBook } : {}),
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
      title={expectedAccount ? "编辑资产账户" : "添加资产账户"}
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
            disabled={Boolean(expectedAccount)}
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
            disabled={Boolean(expectedAccount)}
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
                type={isHidden ? "password" : "text"}
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
            type={isHidden ? "password" : "text"}
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
        {isDifferentAccount || isDifferentBook || error ? (
          <p className="error-message" role="alert">
            {isDifferentBook
              ? "账本或绑定身份已变化，请关闭编辑器并重新打开；当前草稿尚未保存。"
              : isDifferentAccount
                ? "账户已切换，请关闭编辑器并重新打开；当前草稿尚未保存。"
                : error}
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
            disabled={isSaving || isDifferentAccount || isDifferentBook}
            type="submit"
          >
            {isSaving ? "保存中…" : "保存账户"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
