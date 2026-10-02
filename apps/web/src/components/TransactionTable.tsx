const MONTH_START = 5;
const DAY_END = 10;
import { CategoryIcon, Icons } from "./Icons";
import {
  type BillRecord,
  signedMoney,
  displayAccount,
  resolveAssetAccount,
  type AssetAccount,
} from "@hamster-ledger/core";
interface TransactionTableProps {
  records: BillRecord[];
  onSelect: (record: BillRecord) => void;
  showStatus?: boolean;
  accounts?: AssetAccount[];
}
const STATUS_LABELS = {
  confirmed: "已入账",
  pending: "待确认",
  duplicate: "重复记录",
};
export function TransactionTable({
  records,
  onSelect,
  showStatus = false,
  accounts = [],
}: TransactionTableProps): React.JSX.Element {
  if (!records.length)
    return (
      <div className="empty-state">
        <Icons.Empty size={38} weight="duotone" />
        <h3>这里还没有账单</h3>
        <p>试试调整筛选条件，或导入一份账单。</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="transaction-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>商户与说明</th>
            <th>分类</th>
            <th>收付款账户</th>
            {showStatus ? <th>状态</th> : null}
            <th className="amount-cell">金额</th>
            <th className="detail-cell">操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const managed = resolveAssetAccount(record, accounts);
            return (
              <tr key={record.id}>
                <td className="date-cell">
                  {record.date.slice(MONTH_START, DAY_END).replace("-", ".")}
                </td>
                <td>
                  <button
                    className="merchant-button"
                    aria-label={`打开${record.merchant}账单`}
                    onClick={() => onSelect(record)}
                  >
                    <span className="merchant-icon">
                      <CategoryIcon
                        category={record.category}
                        merchant={record.merchant}
                      />
                    </span>
                    <span className="merchant-copy">
                      <strong>{record.merchant}</strong>
                      <small>
                        {[record.source, ...record.linkedSources].join(" + ")}
                        {record.linkedSources.length ? " · 已关联" : ""}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className={`category-tag category-${record.category}`}>
                    <CategoryIcon category={record.category} />
                    {record.category}
                  </span>
                </td>
                <td className="account-cell">
                  {managed?.name ?? displayAccount(record)}
                  {managed && managed.name !== record.account ? (
                    <small>账单记载：{record.account || "未提供"}</small>
                  ) : null}
                  {record.kind === "转账" && record.transferToAccountId ? (
                    <small>
                      →{" "}
                      {accounts.find(
                        (account) => account.id === record.transferToAccountId,
                      )?.name ?? "未知转入账户"}
                    </small>
                  ) : null}
                </td>
                {showStatus ? (
                  <td>
                    <span className={`record-status ${record.status}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                ) : null}
                <td
                  className={`amount-cell ${record.kind === "收入" || record.kind === "退款" ? "positive" : ""}`}
                >
                  {signedMoney(record)}
                </td>
                <td className="detail-cell">
                  <button
                    className="text-button record-detail-button"
                    onClick={() => onSelect(record)}
                    aria-label={`查看${record.merchant}账单详情`}
                  >
                    详情
                    <Icons.Caret size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
