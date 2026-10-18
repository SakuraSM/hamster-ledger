import { Button } from "@mantine/core";
import {
  formatCurrency,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { useAccountHistory } from "@hamster-ledger/ledger-react";
import { Choice } from "../../ui/Choice";
import { TransactionTable } from "../TransactionTable";

interface AccountHistoryProps {
  ledger: Ledger;
  account: AssetAccount;
  through: string;
  onRecord: (record: BillRecord) => void;
}
export function AccountHistory({
  ledger,
  account,
  through,
  onRecord,
}: AccountHistoryProps): React.JSX.Element {
  const history = useAccountHistory({ ledger, account, through });
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  return (
    <section className="account-transactions">
      <div className="section-heading">
        <h2>账户明细</h2>
        <Choice
          aria-label="账户账期"
          value={history.month}
          onChange={history.setMonth}
        >
          <option value="">全部账期</option>
          {history.months.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </Choice>
      </div>
      <div className="account-history-tabs" role="group" aria-label="明细类型">
        <Button
          variant={history.mode === "changes" ? "filled" : "subtle"}
          aria-pressed={history.mode === "changes"}
          onClick={() => history.setMode("changes")}
        >
          余额变动
        </Button>
        <Button
          variant={history.mode === "records" ? "filled" : "subtle"}
          aria-pressed={history.mode === "records"}
          onClick={() => history.setMode("records")}
        >
          关联账单
        </Button>
      </div>
      <p className="muted small">
        {history.mode === "changes"
          ? "按账户原币展示已生效变动。正数表示余额增加，负数表示余额减少；负债减少表示还款。"
          : "包含待确认及基准之前的账单；这些记录不会再次叠加到当前余额。重复与已删除账单不展示。"}
      </p>
      {history.mode === "records" ? (
        <TransactionTable
          accounts={ledger.accounts}
          records={history.records}
          onSelect={onRecord}
          showStatus
        />
      ) : (
        <div className="account-activity-list">
          {history.activities.map((row) => (
            <div className="account-activity-row" key={row.id}>
              <div>
                <span className="activity-kind">{row.label}</span>
                <strong>{row.description}</strong>
                <small>{row.at}</small>
              </div>
              <div className="activity-amount">
                <strong>
                  {row.change === null
                    ? "初始余额"
                    : `${row.change >= 0 ? "+" : ""}${amount(row.change)}`}
                </strong>
                <small>变动后 {amount(row.balance)}</small>
              </div>
              {row.record ? (
                <Button
                  variant="subtle"
                  aria-label={`查看${row.record.merchant}账单详情`}
                  onClick={() => row.record && onRecord(row.record)}
                >
                  详情
                </Button>
              ) : (
                <span className="muted small">余额基准</span>
              )}
            </div>
          ))}
        </div>
      )}
      {!history.count ? (
        <p className="empty-panel">
          所选账期暂无{history.mode === "changes" ? "余额变动" : "关联账单"}。
        </p>
      ) : null}
      <div className="account-pagination">
        <span>
          共 {history.count} 条 · 第 {history.page} / {history.pages} 页
        </span>
        <Button
          variant="subtle"
          disabled={history.page <= 1}
          onClick={() => history.setPage(history.page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="subtle"
          disabled={history.page >= history.pages}
          onClick={() => history.setPage(history.page + 1)}
        >
          下一页
        </Button>
      </div>
    </section>
  );
}
