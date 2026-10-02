import { useMemo, useState } from "react";
import {
  projectAccountBalance,
  summarizeAssets,
  resolveAssetAccount,
  money,
  type AssetAccount,
  type Ledger,
  type BillRecord,
  type AccountBalance,
} from "@hamster-ledger/core";
import { localNow } from "../../platform/browser/runtime";
import { AccountEditor, type AccountSave } from "./AccountEditor";
import { AccountDetail } from "./AccountDetail";
import { Icons } from "../Icons";
interface AssetsPageProps {
  ledger: Ledger;
  isDemo: boolean;
  onSave: (input: AccountSave) => Promise<void>;
  onArchive: (input: {
    accountId: string;
    isArchived: boolean;
  }) => Promise<void>;
  onRecord: (record: BillRecord) => void;
  onUnassigned: () => void;
  onLoadExamples: () => Promise<void>;
}
interface AccountGroupProps {
  title: string;
  accounts: AccountBalance[];
  onSelect: (id: string) => void;
}
function AccountGroup({
  title,
  accounts,
  onSelect,
}: AccountGroupProps): React.JSX.Element {
  if (!accounts.length)
    return (
      <section className="asset-account-group">
        <h2>{title}</h2>
        <p className="muted">还没有{title}，可添加银行卡、现金或贷款等账户。</p>
      </section>
    );
  return (
    <section className="asset-account-group">
      <div className="section-heading">
        <h2>
          {title}
          <small> {accounts.length} 个</small>
        </h2>
        <span>当前余额</span>
      </div>
      <div className="asset-account-list">
        {accounts.map(({ account, balance, movementCount }) => {
          const Icon =
            account.kind === "liability"
              ? Icons.Credit
              : account.type === "银行卡"
                ? Icons.Bank
                : Icons.Wallet;
          return (
            <button
              className="asset-account-row"
              key={account.id}
              onClick={() => onSelect(account.id)}
            >
              <span className="account-symbol">
                <Icon size={24} weight="duotone" />
              </span>
              <span className="account-name">
                <strong>{account.name}</strong>
                <small>
                  {account.type} ·{" "}
                  {account.isArchived
                    ? "已归档"
                    : `${movementCount} 笔基准后变动`}
                </small>
              </span>
              <span className="account-row-balance">
                {account.kind === "liability" && balance < 0 ? (
                  <small>预存</small>
                ) : null}
                ¥{" "}
                {money(
                  account.kind === "liability" ? Math.abs(balance) : balance,
                )}
              </span>
              <Icons.Caret size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
export function AssetsPage({
  ledger,
  isDemo,
  onSave,
  onArchive,
  onRecord,
  onUnassigned,
  onLoadExamples,
}: AssetsPageProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    account?: AssetAccount;
    isCalibration?: boolean;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [actionError, setActionError] = useState("");
  async function loadExamples(): Promise<void> {
    try {
      await onLoadExamples();
      setActionError("");
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "示例账户载入失败。",
      );
    }
  }
  const through = localNow();
  const totals = useMemo(
    () => summarizeAssets({ ledger, through }),
    [ledger, through],
  );
  const selected = ledger.accounts.find((account) => account.id === selectedId);
  const displayed = showArchived
    ? ledger.accounts.map((account) =>
        projectAccountBalance({ account, ledger, through }),
      )
    : totals.balances;
  const unassigned = ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.status === "confirmed" &&
      (record.kind === "收入" ||
        record.kind === "支出" ||
        record.kind === "退款") &&
      !resolveAssetAccount(record, ledger.accounts),
  ).length;
  return (
    <>
      {actionError ? (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      ) : null}
      <div className="assets-page">
        {selected ? (
          <AccountDetail
            account={selected}
            ledger={ledger}
            through={through}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditor({ account: selected })}
            onCalibrate={() =>
              setEditor({ account: selected, isCalibration: true })
            }
            onArchive={() =>
              onArchive({
                accountId: selected.id,
                isArchived: !selected.isArchived,
              })
            }
            onRecord={onRecord}
          />
        ) : (
          <>
            <div className="page-heading heading-with-action">
              <div>
                <h1>资产，也有一本清楚的账</h1>
                <p>维护账户余额，掌握资产、负债与净资产</p>
              </div>
              <button className="primary-button" onClick={() => setEditor({})}>
                <Icons.Plus size={19} />
                添加账户
              </button>
            </div>
            <section
              className="summary asset-summary"
              aria-label="资产负债汇总"
            >
              <div className="summary-primary">
                <div className="metric-label">
                  净资产 <small>{isDemo ? "（示例账本）" : ""}</small>
                </div>
                <strong>
                  <span>¥</span>
                  {money(totals.netAssets)}
                </strong>
              </div>
              <div>
                <div className="metric-label">总资产</div>
                <strong>
                  <span>¥</span>
                  {money(totals.assets)}
                </strong>
              </div>
              <div>
                <div className="metric-label">总负债</div>
                <strong>
                  <span>¥</span>
                  {money(totals.liabilities)}
                </strong>
              </div>
            </section>
            <p className="asset-total-caption">
              净资产 = 总资产 − 总负债 · 截至 {through} · 已归档账户不计入
            </p>
            {!ledger.accounts.length ? (
              <div className="asset-onboarding">
                <Icons.Wallet size={42} weight="duotone" />
                <h2>先添加一个资产或负债账户</h2>
                <p>
                  填写某时点的余额，并设置导入账单的账户别名。之后的已确认流水会更新账户余额。
                </p>
                <button
                  className="primary-button"
                  onClick={() => setEditor({})}
                >
                  添加第一个账户
                </button>
                {isDemo ? (
                  <button className="text-button" onClick={loadExamples}>
                    载入虚拟资产示例
                  </button>
                ) : null}
              </div>
            ) : null}
            {unassigned > 0 ? (
              <button className="account-link-reminder" onClick={onUnassigned}>
                <Icons.Link size={20} />
                {unassigned} 条账单尚未关联资产账户
                <Icons.Arrow size={18} />
              </button>
            ) : null}
            <div className="asset-groups">
              <AccountGroup
                title="资产账户"
                accounts={displayed.filter(
                  (item) => item.account.kind === "asset",
                )}
                onSelect={setSelectedId}
              />
              <AccountGroup
                title="负债账户"
                accounts={displayed.filter(
                  (item) => item.account.kind === "liability",
                )}
                onSelect={setSelectedId}
              />
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              显示已归档账户
            </label>
            <p className="muted small asset-explanation">
              账户余额需要你维护基准。收入/退款增加资产余额，支出减少资产余额；信用卡支出增加负债，退款与还款减少负债。余额未接入银行实时查询。
            </p>
          </>
        )}
      </div>
      {editor ? (
        <AccountEditor
          account={editor.account}
          isCalibration={editor.isCalibration}
          currentBalance={
            editor.account
              ? projectAccountBalance({
                  account: editor.account,
                  ledger,
                  through,
                }).balance
              : undefined
          }
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
}
