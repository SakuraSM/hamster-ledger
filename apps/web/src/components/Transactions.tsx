import { useState } from "react";
import {
  CATEGORIES,
  SOURCES,
  type BillRecord,
  type Category,
  type Source,
} from "@hamster-ledger/core";
import { Icons } from "./Icons";
import { TransactionTable } from "./TransactionTable";
import { exportRecords } from "../platform/browser/downloads";
const PAGE_SIZE = 20;
export interface BillFilter {
  source: Source | "";
  category: Category | "";
}
interface TransactionsProps {
  records: BillRecord[];
  filter: BillFilter;
  onFilter: (filter: BillFilter) => void;
  onSelect: (record: BillRecord) => void;
}
export function Transactions({
  records,
  filter,
  onFilter,
  onSelect,
}: TransactionsProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const filtered = records
    .filter(
      (record) =>
        (!filter.source ||
          record.source === filter.source ||
          record.linkedSources.includes(filter.source)) &&
        (!filter.category || record.category === filter.category) &&
        (!status ? record.status !== "duplicate" : record.status === status) &&
        (!query ||
          [record.merchant, record.description, record.account, record.orderId]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort((left, right) => right.date.localeCompare(left.date));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageIndex, totalPages - 1);
  return (
    <section className="transactions-page">
      <div className="page-heading heading-with-action">
        <div>
          <h1>每一笔，都有来处</h1>
          <p>查找、筛选和整理你的全部账单</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => exportRecords(filtered)}
          disabled={!filtered.length}
        >
          <Icons.Download size={19} />
          导出账单
        </button>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Icons.Search size={20} />
          <input
            aria-label="搜索账单"
            placeholder="搜索商户、备注或流水号"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPageIndex(0);
            }}
          />
        </label>
        <select
          aria-label="账单来源"
          value={filter.source}
          onChange={(event) => {
            onFilter({ ...filter, source: event.target.value as Source | "" });
            setPageIndex(0);
          }}
        >
          <option value="">全部来源</option>
          {SOURCES.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
        <select
          aria-label="账单分类"
          value={filter.category}
          onChange={(event) => {
            onFilter({
              ...filter,
              category: event.target.value as Category | "",
            });
            setPageIndex(0);
          }}
        >
          <option value="">全部分类</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select
          aria-label="处理状态"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPageIndex(0);
          }}
        >
          <option value="">有效与待确认</option>
          <option value="confirmed">已入账</option>
          <option value="pending">待确认</option>
          <option value="duplicate">重复记录</option>
        </select>
      </div>
      <p className="list-caption">
        共 {filtered.length} 条记录 <span>点击商户查看原始流水与识别信息</span>
      </p>
      <TransactionTable
        records={filtered.slice(
          safePage * PAGE_SIZE,
          (safePage + 1) * PAGE_SIZE,
        )}
        onSelect={onSelect}
        showStatus
      />
      <div className="pagination">
        <span>
          第 {safePage + 1} / {totalPages} 页
        </span>
        <button
          className="secondary-button"
          disabled={safePage === 0}
          onClick={() => setPageIndex(safePage - 1)}
        >
          上一页
        </button>
        <button
          className="secondary-button"
          disabled={safePage === totalPages - 1}
          onClick={() => setPageIndex(safePage + 1)}
        >
          下一页
        </button>
      </div>
    </section>
  );
}
