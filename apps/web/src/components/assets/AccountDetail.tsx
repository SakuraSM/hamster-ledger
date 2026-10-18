const DATE_KEY_LENGTH = 10;
import { Button } from "@mantine/core";
import { useState } from "react";
import {
  projectAccountBalance,
  formatCurrency,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { Icons } from "../Icons";
import { AccountHistory } from "./AccountHistory";
interface AccountDetailProps {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
  onBack: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
  onTransfer: () => void;
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
  onTransfer,
  onArchive,
  onRecord,
}: AccountDetailProps): React.JSX.Element {
  const [error, setError] = useState("");
  const [isArchiving, setArchiving] = useState(false);
  const projection = projectAccountBalance({ account, ledger, through });
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  const balanceLabel =
    account.kind === "asset"
      ? "账户余额"
      : projection.balance < 0
        ? "预存余额"
        : "剩余负债";
  async function handleArchive(): Promise<void> {
    setArchiving(true);
    try {
      await onArchive();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户归档失败。");
    } finally {
      setArchiving(false);
    }
  }
  return (
    <section className="account-detail-page">
      <Button
        variant="subtle"
        className="text-button account-back"
        onClick={onBack}
      >
        <Icons.Arrow size={18} mirrored />
        返回资产管理
      </Button>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{account.name}</h1>
          <p>
            {account.type} · {account.currency ?? "CNY"} ·{" "}
            {account.isArchived ? "已归档，不计入净资产" : "与已确认账单关联"}
          </p>
        </div>
        <div className="account-actions">
          <Button variant="outline" onClick={onEdit}>
            编辑账户
          </Button>
          {!account.isArchived ? (
            <Button variant="outline" onClick={onTransfer}>
              {account.kind === "liability" ? "还款" : "转账"}
            </Button>
          ) : null}
          <Button onClick={onCalibrate}>校准余额</Button>
        </div>
      </div>
      <div className="account-balance-hero">
        <span>
          {balanceLabel} · 截至 {through.slice(0, DATE_KEY_LENGTH)}
        </span>
        <strong>
          {projection.baseline
            ? amount(
                account.kind === "liability"
                  ? Math.abs(projection.balance)
                  : projection.balance,
              )
            : "尚无余额基准"}
        </strong>
        {projection.baseline ? (
          <>
            <p>
              基准 {amount(projection.baseline.balance)} ·{" "}
              {projection.baseline.at} 确认
            </p>
            <p>
              之后已确认账单变动 {projection.change >= 0 ? "+" : ""}
              {amount(projection.change)} · {projection.movementCount} 笔
            </p>
          </>
        ) : null}
      </div>
      {account.aliases.length ? (
        <p className="account-aliases">
          匹配别名：{account.aliases.join("、")}
        </p>
      ) : null}
      <AccountHistory
        key={account.id}
        ledger={ledger}
        account={account}
        through={through}
        onRecord={onRecord}
      />
      <details className="balance-history">
        <summary>余额维护记录（{account.checkpoints.length}）</summary>
        {account.checkpoints.length ? (
          <ol>
            {[...account.checkpoints].reverse().map((checkpoint) => (
              <li key={checkpoint.id}>
                <strong>{amount(checkpoint.balance)}</strong>
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
      <Button
        variant="subtle"
        className="text-button archive-account"
        loading={isArchiving}
        onClick={handleArchive}
      >
        {account.isArchived ? "恢复账户" : "归档账户"}
      </Button>
      <p className="muted small">
        归档保留历史账单和账户关联，可恢复；操作后可撤销。
      </p>
    </section>
  );
}
