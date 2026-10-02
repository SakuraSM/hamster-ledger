import { useState } from "react";
import {
  ASSET_TYPES,
  LIABILITY_TYPES,
  type AssetAccount,
  type AccountKind,
} from "@hamster-ledger/core";
import { parseAmount } from "@hamster-ledger/importers";
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
const CENTS_PER_YUAN = 100;
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
  const [balance, setBalance] = useState(
    String(
      (isCalibration ? (currentBalance ?? 0) : (account?.openingBalance ?? 0)) /
        CENTS_PER_YUAN,
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
    const amount = parseAmount(balance);
    if (amount === null) {
      setError("请填写最多两位小数的余额。");
      return;
    }
    setIsSaving(true);
    try {
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
          openingBalance: /^[\s￥¥]*-/.test(balance) ? -amount : amount,
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
          <label className="full-width">
            账户名称
            <input
              required
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="如：招商银行 · 6628、现金、房贷"
            />
          </label>
          <label>
            账户性质
            <select
              value={kind}
              disabled={!!account}
              onChange={(event) => {
                const next = event.target.value as AccountKind;
                setKind(next);
                setType(next === "asset" ? "银行卡" : "信用卡");
              }}
            >
              <option value="asset">资产账户</option>
              <option value="liability">负债账户</option>
            </select>
          </label>
          <label>
            账户类型
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as AssetAccount["type"])
              }
            >
              {types.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            {kind === "asset" ? "基准余额（元）" : "基准负债（元）"}
            <input
              required
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0.00"
            />
          </label>
          <label>
            余额确认时间
            <input
              required
              type="datetime-local"
              step="1"
              value={balanceAt}
              onChange={(event) => setBalanceAt(event.target.value)}
            />
          </label>
          <label className="full-width">
            账单账户别名
            <textarea
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              rows={3}
              placeholder="每行一个，如：招商银行 · 6628\n用于匹配导入账单的实际付款账户"
            />
          </label>
          <label className="full-width">
            余额维护说明
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="如：核对银行余额、更新投资估值"
            />
          </label>
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
          <button className="secondary-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "保存中…" : "保存账户"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
