import {
  useBatchRecords,
  useBookMembers,
  useTransactionQuery,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { money, type ReimbursementState } from "@hamster-ledger/core";
import { useNetworkClient } from "../hooks/useNetworkController";
import { BatchActions } from "./finance/BatchActions";
import { RecordFilters } from "./finance/RecordFilters";
import { TransactionRange, EMPTY_RANGE } from "./finance/TransactionRange";
import { Button, TextInput } from "@mantine/core";
import { Choice } from "../ui/Choice";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  SOURCES,
  type BillRecord,
  type Category,
  type Source,
  type AssetAccount,
  UNASSIGNED_ACCOUNT_FILTER,
} from "@hamster-ledger/core";
import { Icons } from "./Icons";
import { TransactionTable } from "./TransactionTable";
import { exportRecords } from "../platform/browser/downloads";
const PAGE_SIZE = 20;
export interface BillFilter {
  source: Source | "";
  category: Category | "";
  accountId?: string;
}
interface TransactionsProps {
  records: BillRecord[];
  controller: LedgerController;
  accounts: AssetAccount[];
  filter: BillFilter;
  onFilter: (filter: BillFilter) => void;
  onSelect: (record: BillRecord) => void;
  onClearPeriod: () => void;
}
export function Transactions({
  records,
  controller,
  accounts,
  filter,
  onFilter,
  onSelect,
  onClearPeriod,
}: TransactionsProps): React.JSX.Element {
  const remoteMembers = useBookMembers(
    useNetworkClient(),
    controller.books.find((book) => book.id === controller.mode)?.cloud?.id,
  );
  const memberIds = useMemo(
    () => [
      ...new Set(
        records
          .flatMap((record) => [
            record.detail?.memberId,
            ...(record.detail?.splits.map((item) => item.memberId) ?? []),
          ])
          .filter((id): id is string => !!id),
      ),
    ],
    [records],
  );
  const members = useMemo(
    () =>
      memberIds.map((id) => ({
        id,
        username: remoteMembers.find((item) => item.id === id)?.username ?? id,
      })),
    [memberIds, remoteMembers],
  );
  const [memberId, setMember] = useState("");
  const [reimbursement, setReimbursement] = useState<ReimbursementState>("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BillRecord["status"] | "">("");
  const [range, setRange] = useState(EMPTY_RANGE);
  const [pageIndex, setPageIndex] = useState(0);
  const queryFilter = useMemo(
    () => ({ ...filter, ...range, query, status, memberId, reimbursement }),
    [filter, range, query, status, memberId, reimbursement],
  );
  const result = useTransactionQuery(controller.ledger, queryFilter, records);
  const filtered = result.records;
  const batch = useBatchRecords(controller, filtered);
  function clearFilters(): void {
    onFilter({ source: "", category: "" });
    onClearPeriod();
    setRange(EMPTY_RANGE);
    setQuery("");
    setStatus("");
    setMember("");
    setReimbursement("");
    setPageIndex(0);
  }
  const amount = (value: number): string =>
    controller.ledger.preferences?.hideAmounts ? "••••" : `¥${money(value)}`;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageIndex, totalPages - 1);
  return (
    <section className="transactions-page">
      <div className="page-heading heading-with-action">
        <div>
          <h1>每一笔，都有来处</h1>
          <p>查找、筛选和整理你的全部账单</p>
        </div>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          onClick={() => exportRecords(filtered)}
          disabled={!filtered.length}
        >
          <Icons.Download size={19} />
          导出账单
        </Button>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Icons.Search size={20} />
          <TextInput
            aria-label="搜索账单"
            placeholder="搜索商户、备注、标签或流水号"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPageIndex(0);
            }}
          />
        </label>
        <Choice
          aria-label="账单来源"
          value={filter.source}
          onChange={(value) => {
            onFilter({ ...filter, source: value as Source | "" });
            setPageIndex(0);
          }}
        >
          <option value="">全部来源</option>
          {SOURCES.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </Choice>
        <Choice
          aria-label="账单分类"
          value={filter.category}
          onChange={(value) => {
            onFilter({
              ...filter,
              category: value as Category | "",
            });
            setPageIndex(0);
          }}
        >
          <option value="">全部分类</option>
          {[
            ...new Set([
              ...CATEGORIES,
              ...records.map((record) => record.category),
            ]),
          ].map((category) => (
            <option key={category}>{category}</option>
          ))}
        </Choice>
        <Choice
          aria-label="关联资产账户"
          value={filter.accountId ?? ""}
          onChange={(value) => {
            onFilter({ ...filter, accountId: value });
            setPageIndex(0);
          }}
        >
          <option value="">全部账户</option>
          <option value={UNASSIGNED_ACCOUNT_FILTER}>未关联账户</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.isArchived ? "（已归档）" : ""}
            </option>
          ))}
        </Choice>
        <Choice
          aria-label="处理状态"
          value={status}
          onChange={(value) => {
            setStatus(value as BillRecord["status"] | "");
            setPageIndex(0);
          }}
        >
          <option value="">有效与待确认</option>
          <option value="confirmed">已入账</option>
          <option value="pending">待确认</option>
          <option value="duplicate">重复记录</option>
        </Choice>
        <RecordFilters
          memberId={memberId}
          reimbursement={reimbursement}
          members={members}
          onMember={(value) => {
            setMember(value);
            setPageIndex(0);
          }}
          onReimbursement={(value) => {
            setReimbursement(value);
            setPageIndex(0);
          }}
        />
      </div>
      <TransactionRange
        value={range}
        onChange={(value) => {
          setRange(value);
          setPageIndex(0);
          if (
            value.startDate !== range.startDate ||
            value.endDate !== range.endDate
          )
            onClearPeriod();
        }}
        onClear={clearFilters}
      />
      {result.error ? (
        <p role="alert" className="error-message">
          {result.error}
        </p>
      ) : (
        <p className="filter-summary">
          筛选内已入账：收入 {amount(result.summary.income)} · 净支出{" "}
          {amount(result.summary.expense)} · 结余 {amount(result.summary.net)}
          <br />
          <small>
            净支出已扣退款；待确认、重复、转账及不计收支的记录不计入合计。
          </small>
        </p>
      )}
      <BatchActions
        ledger={controller.ledger}
        batch={batch}
        onSelectAll={() => batch.select(filtered)}
      />
      <p className="list-caption">
        共 {filtered.length} 条记录{" "}
        <span>点击“详情”查看原始流水与账户关联</span>
      </p>
      <TransactionTable
        accounts={accounts}
        records={filtered.slice(
          safePage * PAGE_SIZE,
          (safePage + 1) * PAGE_SIZE,
        )}
        onSelect={onSelect}
        selected={batch.selected}
        onToggle={batch.toggle}
        showStatus
      />
      <div className="pagination">
        <span>
          第 {safePage + 1} / {totalPages} 页
        </span>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          disabled={safePage === 0}
          onClick={() => setPageIndex(safePage - 1)}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          type="submit"
          className="secondary-button"
          disabled={safePage === totalPages - 1}
          onClick={() => setPageIndex(safePage + 1)}
        >
          下一页
        </Button>
      </div>
    </section>
  );
}
