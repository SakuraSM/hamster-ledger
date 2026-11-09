import { useMemo, useState } from "react";
import {
  addDays,
  cycleRange,
  money,
  reportGroups,
  summarize,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
import { CashFlowChart } from "./CashFlowChart";
import { ReportDistribution } from "./ReportDistribution";
import { ExtendedReports } from "./ExtendedReports";

const MONTH_KEY_LENGTH = 7;
const YEAR_KEY_LENGTH = 4;
const DATE_KEY_LENGTH = 10;
const THREE_CYCLES = 3;
const SIX_CYCLES = 6;
interface ReportsPageProps {
  ledger: Ledger;
  month: string;
  bookId?: string;
  onRecord?: (record: BillRecord) => void;
  onReimburse?: (record: BillRecord) => void;
}
export function ReportsPage({
  ledger,
  month,
  bookId,
  onRecord,
  onReimburse,
}: ReportsPageProps): React.JSX.Element {
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const cycleStartDay = ledger.preferences?.cycleStartDay ?? 1;
  const currentCycle = cycleRange(month, cycleStartDay);
  const currentEnd = addDays(currentCycle.end, -1);
  const [start, setStart] = useState(currentCycle.start);
  const [end, setEnd] = useState(currentEnd);
  const [kind, setKind] = useState<"支出" | "收入">("支出");
  const [dimension, setDimension] = useState<"category" | "tag">("category");
  const records = useMemo(
    () =>
      ledger.records.filter(
        (record) =>
          !record.isDeleted &&
          record.date.slice(0, DATE_KEY_LENGTH) >= start &&
          record.date.slice(0, DATE_KEY_LENGTH) <= end,
      ),
    [ledger.records, start, end],
  );
  const totals = useMemo(() => summarize(records), [records]);
  const groups = useMemo(
    () => reportGroups({ records, dimension, kind }),
    [records, dimension, kind],
  );
  const amountLabel = (minor: number): string =>
    isHidden ? "••••" : `¥${money(minor)}`;
  function startOfCycles(count: number): string {
    const cursor = new Date(month + "-01T00:00:00Z");
    cursor.setUTCMonth(cursor.getUTCMonth() - count + 1);
    return cycleRange(
      cursor.toISOString().slice(0, MONTH_KEY_LENGTH),
      cycleStartDay,
    ).start;
  }
  function selectCycles(count: number): void {
    setStart(startOfCycles(count));
    setEnd(currentEnd);
  }
  function selectYear(): void {
    setStart(month.slice(0, YEAR_KEY_LENGTH) + "-01-01");
    setEnd(month.slice(0, YEAR_KEY_LENGTH) + "-12-31");
  }
  return (
    <section className="planning-page">
      <div className="page-heading">
        <h1>看清钱花在哪里</h1>
        <p>查看任意时间段的收支、分类与标签。</p>
      </div>
      <div className="report-range-shortcuts" aria-label="报表时间范围">
        <button
          type="button"
          aria-pressed={start === startOfCycles(1) && end === currentEnd}
          onClick={() => selectCycles(1)}
        >
          本账期
        </button>
        <button
          type="button"
          aria-pressed={
            start === startOfCycles(THREE_CYCLES) && end === currentEnd
          }
          onClick={() => selectCycles(THREE_CYCLES)}
        >
          近 3 期
        </button>
        <button
          type="button"
          aria-pressed={
            start === startOfCycles(SIX_CYCLES) && end === currentEnd
          }
          onClick={() => selectCycles(SIX_CYCLES)}
        >
          近 6 期
        </button>
        <button
          type="button"
          aria-pressed={
            start === month.slice(0, YEAR_KEY_LENGTH) + "-01-01" &&
            end === month.slice(0, YEAR_KEY_LENGTH) + "-12-31"
          }
          onClick={selectYear}
        >
          查看全年
        </button>
      </div>
      <div className="report-controls">
        <DateField
          label={<>开始日期</>}
          type="date"
          required
          value={start}
          onChange={(value) => value && setStart(value)}
        />
        <DateField
          label={<>结束日期</>}
          type="date"
          required
          value={end}
          onChange={(value) => value && setEnd(value)}
        />
      </div>
      {start > end ? (
        <p role="alert" className="error-message">
          结束日期应晚于开始日期。
        </p>
      ) : null}
      <div className="report-summary">
        <div>
          <span>净支出</span>
          <strong>{amountLabel(totals.expense)}</strong>
        </div>
        <div>
          <span>收入</span>
          <strong>{amountLabel(totals.income)}</strong>
        </div>
        <div>
          <span>结余</span>
          <strong>{amountLabel(totals.net)}</strong>
        </div>
      </div>
      <div className="report-grid">
        <section className="panel">
          <div className="section-heading report-distribution-heading">
            <div>
              <h2>收支分布</h2>
              <p className="muted small">选择分类，查看对应账单</p>
            </div>
            <div className="report-controls">
              <Choice
                aria-label="统计方向"
                value={kind}
                onChange={(value) =>
                  setKind(value === "收入" ? "收入" : "支出")
                }
              >
                <option>支出</option>
                <option>收入</option>
              </Choice>
              <Choice
                aria-label="统计维度"
                value={dimension}
                onChange={(value) =>
                  setDimension(value === "tag" ? "tag" : "category")
                }
              >
                <option value="category">分类</option>
                <option value="tag">标签</option>
              </Choice>
            </div>
          </div>
          <ReportDistribution
            key={`${kind}:${dimension}:${start}:${end}`}
            groups={groups}
            records={records}
            dimension={dimension}
            kind={kind}
            isHidden={isHidden}
            onRecord={onRecord}
          />
        </section>
        <section className="panel">
          <h2>收支趋势</h2>
          <CashFlowChart
            records={records}
            start={start}
            end={end}
            isHidden={isHidden}
            onRecord={onRecord}
          />
        </section>
      </div>
      <ExtendedReports
        ledger={ledger}
        records={records}
        start={start}
        end={end}
        kind={kind}
        bookId={bookId}
        onRecord={onRecord}
        onReimburse={onReimburse}
      />
    </section>
  );
}
