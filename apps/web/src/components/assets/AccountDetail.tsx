import { Button } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  projectAccountBalance,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { Icons } from "../Icons";
import { Dialog } from "../Dialog";
import { AccountHistory } from "./AccountHistory";
import { accountAmount, assetAccountLabel } from "./asset-format";

const DATE_KEY_LENGTH = 10;
interface AccountDetailProps {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
  isHidden: boolean;
  recordRequest: number;
  traceRequest: number;
  onBack: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
  onTransfer: () => void;
  onArchive: (input: {
    accountId: string;
    isArchived: boolean;
  }) => Promise<void>;
  onRecord: (record: BillRecord) => void;
}

export function AccountDetail({
  account,
  ledger,
  through,
  isHidden,
  recordRequest,
  traceRequest,
  onBack,
  onEdit,
  onCalibrate,
  onTransfer,
  onArchive,
  onRecord,
}: AccountDetailProps): React.JSX.Element {
  const [error, setError] = useState("");
  const [isArchiving, setArchiving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
    isArchived: boolean;
  } | null>(null);
  const [hasArchiveConflict, setArchiveConflict] = useState(false);
  const isArchiveChanged = Boolean(
    archiveTarget &&
    (archiveTarget.id !== account.id ||
      archiveTarget.isArchived !== account.isArchived),
  );
  const isArchiveStale = hasArchiveConflict || isArchiveChanged;
  useEffect(() => {
    if (isArchiveChanged) setArchiveConflict(true);
  }, [isArchiveChanged]);
  const projection = projectAccountBalance({ account, ledger, through });
  const amount = (minor: number): string =>
    accountAmount({ minor, currency: account.currency ?? "CNY", isHidden });
  const accountLabel = assetAccountLabel({
    account,
    accounts: ledger.accounts,
    isHidden,
  });
  const balanceLabel =
    account.kind === "asset"
      ? "当前账户余额"
      : isHidden
        ? "负债账户余额"
        : projection.balance < 0
          ? "预存余额"
          : "剩余负债";
  async function handleArchive(): Promise<void> {
    if (!archiveTarget || isArchiveStale || isArchiving) return;
    setArchiving(true);
    try {
      await onArchive({
        accountId: archiveTarget.id,
        isArchived: !archiveTarget.isArchived,
      });
      setError("");
      setArchiveTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "账户状态更新失败。");
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
        <Icons.Arrow size={18} mirrored /> 返回资产管理
      </Button>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{accountLabel}</h1>
          <p>
            {account.kind === "asset" ? "资产" : "负债"} · {account.type} ·{" "}
            {account.currency ?? "CNY"} · 截至{" "}
            {through.slice(0, DATE_KEY_LENGTH)}
            {account.isArchived ? " · 已归档" : ""}
          </p>
        </div>
        <Button
          variant="subtle"
          className="asset-inline-action"
          onClick={onEdit}
        >
          编辑账户
        </Button>
      </div>
      <div className="account-balance-hero">
        <span>{balanceLabel}</span>
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
          <div className="account-balance-breakdown">
            <div>
              <span>基准 · {projection.baseline.at}</span>
              <strong>{amount(projection.baseline.balance)}</strong>
            </div>
            <div>
              <span>之后已确认变动 · {projection.movementCount} 笔</span>
              <strong>
                {!isHidden && projection.change >= 0 ? "+" : ""}
                {amount(projection.change)}
              </strong>
            </div>
          </div>
        ) : (
          <p>此日期之前没有余额基准。可校准余额后开始计算。</p>
        )}
      </div>
      {account.type === "信用卡" &&
      (account.statementDay ||
        account.paymentDay ||
        account.creditLimit !== undefined) ? (
        <div className="account-credit-facts">
          {account.statementDay ? (
            <div>
              <span>账单日</span>
              <strong>每月 {account.statementDay} 日</strong>
            </div>
          ) : null}
          {account.paymentDay ? (
            <div>
              <span>还款日</span>
              <strong>每月 {account.paymentDay} 日</strong>
            </div>
          ) : null}
          {account.creditLimit !== undefined ? (
            <div>
              <span>信用额度</span>
              <strong>{amount(account.creditLimit)}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="account-balance-note">
        余额来自基准之后的已确认流水。待确认、重复和已删除记录不会重复叠加。
      </p>
      {!isHidden && account.aliases.length ? (
        <p className="account-aliases">
          匹配别名：{account.aliases.join("、")}
        </p>
      ) : null}
      <AccountHistory
        key={account.id}
        ledger={ledger}
        account={account}
        through={through}
        isHidden={isHidden}
        recordRequest={recordRequest}
        traceRequest={traceRequest}
        onRecord={onRecord}
      />
      <details className="balance-history">
        <summary>余额基准与历史（{account.checkpoints.length}）</summary>
        {account.checkpoints.length ? (
          <ol>
            {[...account.checkpoints].reverse().map((checkpoint) => (
              <li key={checkpoint.id}>
                <strong>{amount(checkpoint.balance)}</strong>
                <span>
                  {isHidden ? "余额基准" : checkpoint.note} · 基准时间{" "}
                  {checkpoint.at}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>此账户尚无校准记录。</p>
        )}
      </details>
      <div className="account-actions">
        <Button className="primary-button" onClick={onCalibrate}>
          核对实际余额
        </Button>
        {!account.isArchived ? (
          <Button variant="outline" onClick={onTransfer}>
            {account.kind === "liability" ? "还款" : "转账"}
          </Button>
        ) : null}
        <Button variant="subtle" onClick={onEdit}>
          编辑账户
        </Button>
      </div>
      <Button
        variant="subtle"
        className="text-button archive-account"
        onClick={() => {
          setError("");
          setArchiveConflict(false);
          setArchiveTarget({
            id: account.id,
            name: account.name,
            isArchived: account.isArchived,
          });
        }}
      >
        {account.isArchived ? "恢复账户" : "归档账户"}
      </Button>
      <p className="muted small">
        归档保留历史账单和账户关联，可恢复；操作后可撤销。
      </p>
      {archiveTarget ? (
        <Dialog
          title={archiveTarget.isArchived ? "恢复账户" : "归档账户"}
          onClose={() => setArchiveTarget(null)}
        >
          <p>
            {archiveTarget.isArchived
              ? `恢复“${isHidden ? accountLabel : archiveTarget.name}”后，将从恢复时间起重新计入资产。`
              : `归档“${isHidden ? accountLabel : archiveTarget.name}”后，将从归档时间起不再计入资产；历史账单和之前的资产历史会保留。`}
          </p>
          {isArchiveStale || error ? (
            <p className="error-message" role="alert">
              {isArchiveStale
                ? "账户或归档状态已变化，请关闭后重新核对。"
                : error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={isArchiving}
              onClick={() => setArchiveTarget(null)}
            >
              取消
            </Button>
            <Button
              loading={isArchiving}
              disabled={isArchiveStale}
              onClick={() => void handleArchive()}
            >
              {archiveTarget.isArchived ? "确认恢复" : "确认归档"}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
