import {
  accountMovement,
  resolveAssetAccount,
  money,
  type AssetAccount,
  type BillRecord,
  type Kind,
} from "@hamster-ledger/core";
interface RecordAccountFieldsProps {
  record: BillRecord;
  accounts: AssetAccount[];
  kind: Kind;
  accountId: string;
  transferToAccountId: string;
  onAccount: (id: string) => void;
  onDestination: (id: string) => void;
}
export function RecordAccountFields({
  record,
  accounts,
  kind,
  accountId,
  transferToAccountId,
  onAccount,
  onDestination,
}: RecordAccountFieldsProps): React.JSX.Element {
  const selected = accounts.find((account) => account.id === accountId);
  const options = accounts.filter(
    (account) =>
      !account.isArchived ||
      account.id === accountId ||
      account.id === transferToAccountId,
  );
  const projected = {
    ...record,
    kind,
    accountId: accountId || null,
    transferToAccountId: kind === "转账" ? transferToAccountId || null : null,
  };
  const movement =
    selected && record.date > selected.balanceAt
      ? accountMovement({ record: projected, account: selected, accounts })
      : 0;
  const label =
    kind === "转账"
      ? "转出账户"
      : kind === "收入"
        ? "收入账户"
        : kind === "退款"
          ? "退款到账账户"
          : "关联资产账户";
  return (
    <fieldset className="record-account-fields">
      <legend>账户关联</legend>
      <div className="form-grid">
        <label className={kind === "转账" ? "" : "full-width"}>
          {label}
          <select
            value={accountId}
            onChange={(event) => onAccount(event.target.value)}
          >
            <option value="">不关联资产账户</option>
            {options.map((account) => (
              <option
                key={account.id}
                value={account.id}
                disabled={account.isArchived && account.id !== accountId}
              >
                {account.name} · {account.kind === "asset" ? "资产" : "负债"}
                {account.isArchived ? "（已归档）" : ""}
              </option>
            ))}
          </select>
        </label>
        {kind === "转账" ? (
          <label>
            转入 / 还款账户
            <select
              value={transferToAccountId}
              onChange={(event) => onDestination(event.target.value)}
            >
              <option value="">请选择转入账户</option>
              {options
                .filter((account) => account.id !== accountId)
                .map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                    disabled={
                      account.isArchived && account.id !== transferToAccountId
                    }
                  >
                    {account.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>
      {!accounts.length ? (
        <p>先在“资产管理”添加账户，再关联这条账单。</p>
      ) : !selected ? (
        <p>这条账单仍计入相应收入或支出，但不影响资产余额。</p>
      ) : (
        <p>
          {record.status === "duplicate"
            ? "重复记录不影响余额。"
            : record.status === "pending"
              ? "待确认账单暂不影响余额。"
              : record.date <= selected.balanceAt
                ? "交易发生在余额基准之前，不再叠加到当前余额。"
                : kind === "转账" && !transferToAccountId
                  ? "补全转入账户后才更新两端余额，转账与还款不计收入支出。"
                  : `${selected.name} 的基准后余额变化：${movement >= 0 ? "+" : ""}${money(movement)} 元。`}
        </p>
      )}
      {resolveAssetAccount(record, accounts) &&
      record.accountId === undefined ? (
        <p className="small">
          已按原始付款账户的名称或别名匹配，保存后固定关联。
        </p>
      ) : null}
    </fieldset>
  );
}
