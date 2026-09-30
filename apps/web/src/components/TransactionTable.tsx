const MONTH_START = 5;
const DAY_END = 10;
import { CategoryIcon, Icons } from "./Icons";
import {
  type BillRecord,
  signedMoney,
  displayAccount,
} from "@hamster-ledger/core";
interface TransactionTableProps {
  records: BillRecord[];
  onSelect: (record: BillRecord) => void;
  showStatus?: boolean;
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
            <th>付款账户</th>
            {showStatus ? <th>状态</th> : null}
            <th className="amount-cell">金额</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td className="date-cell">
                {record.date.slice(MONTH_START, DAY_END).replace("-", ".")}
              </td>
              <td>
                <button
                  className="merchant-button"
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
              <td className="account-cell">{displayAccount(record)}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
