const MONTH_KEY_LENGTH = 7;
import { useState } from "react";
import {
  linkedAccountRecords,
  projectAccountBalance,
  summarize,
  money,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { Icons } from "../Icons";
import { TransactionTable } from "../TransactionTable";
interface AccountDetailProps {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
  onBack: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
  onArchive: () => Promise<void>;
  onRecord: (record: BillRecord) => void;
}
export function AccountDetail({
  account,
  ledger,
  through,
  onBack,
  onEdit,
  onCalibrate,
  onArchive,
  onRecord,
}: AccountDetailProps): React.JSX.Element {
  const [month, setMonth] = useState("");
  const [error, setError] = useState("");
  const projection = projectAccountBalance({ account, ledger, through });
  const linked = linkedAccountRecords({
    records: ledger.records,
    accounts: ledger.accounts,
    accountId: account.id,
  });
  const records = linked
    .filter(
      (record) =>
        !record.isDeleted &&
        record.status !== "duplicate" &&
        (!month || record.date.startsWith(month)),
    )
    .sort((left, right) => right.date.localeCompare(left.date));
  const totals = summarize(records);
  const months = [
    ...new Set(linked.map((record) => record.date.slice(0, MONTH_KEY_LENGTH))),
  ]
    .sort()
    .reverse();
  const balanceLabel =
    account.kind === "asset"
      ? "账户余额"
      : projection.balance < 0
        ? "预存余额"
        : "剩余负债";
  async function handleArchive(): Promise<void> {
    try {
      await onArchive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户归档失败。");
    }
  }
  return (
    <section className="account-detail-page">
      <button className="text-button account-back" onClick={onBack}>
        <Icons.Arrow size={18} mirrored />
        返回资产管理
      </button>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{account.name}</h1>
          <p>
            {account.type} ·{" "}
            {account.isArchived ? "已归档，不计入净资产" : "与已确认账单关联"}
          </p>
        </div>
        <div className="account-actions">
          <button className="secondary-button" onClick={onEdit}>
            <Icons.Edit size={18} />
            编辑账户
          </button>
          <button className="primary-button" onClick={onCalibrate}>
            校准余额
          </button>
        </div>
      </div>
      <div className="account-balance-hero">
        <span>{balanceLabel}</span>
        <strong>
          ¥{" "}
          {money(
            account.kind === "liability"
              ? Math.abs(projection.balance)
              : projection.balance,
          )}
        </strong>
        <p>
          基准 {money(account.openingBalance)} 元 · {account.balanceAt} 确认
        </p>
        <p>
          之后已确认账单变动 {projection.change >= 0 ? "+" : ""}
          {money(projection.change)} 元 · {projection.movementCount} 笔
        </p>
      </div>
      {account.aliases.length ? (
        <p className="account-aliases">
          匹配别名：{account.aliases.join("、")}
        </p>
      ) : null}
      <section className="account-transactions">
        <div className="section-heading">
          <h2>关联收入与支出</h2>
          <select
            aria-label="账户账期"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">全部账期</option>
            {months.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="account-flow-summary">
          <span>
            收入 <strong className="positive">¥ {money(totals.income)}</strong>
          </span>
          <span>
            净支出 <strong>¥ {money(totals.expense)}</strong>
          </span>
          <span>{records.length} 条关联记录</span>
        </div>
        <p className="muted small">
          包含余额基准之前的历史账单。待确认不影响余额；重复记录不重复计算；转账与还款不计收入支出。
        </p>
        <TransactionTable
          accounts={ledger.accounts}
          records={records}
          onSelect={onRecord}
          showStatus
        />
      </section>
      <details className="balance-history">
        <summary>余额维护记录（{account.checkpoints.length}）</summary>
        {account.checkpoints.length ? (
          <ol>
            {[...account.checkpoints].reverse().map((checkpoint) => (
              <li key={checkpoint.id}>
                <strong>¥ {money(checkpoint.balance)}</strong>
                <span>
                  {checkpoint.note} · 基准时间 {checkpoint.at}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>此账户尚无校准记录。</p>
        )}
      </details>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      <button className="text-button archive-account" onClick={handleArchive}>
        {account.isArchived ? "恢复账户" : "归档账户"}
      </button>
      <p className="muted small">
        归档保留历史账单和账户关联，可恢复；操作后可撤销。
      </p>
    </section>
  );
}
