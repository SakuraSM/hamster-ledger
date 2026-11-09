import { useState } from "react";
import { money, type BillRecord } from "@hamster-ledger/core";

const PAGE_SIZE = 8;
const DATE_KEY_LENGTH = 10;
interface ReportRecordListProps {
  records: BillRecord[];
  onRecord?: (record: BillRecord) => void;
}
export function ReportRecordList({
  records,
  onRecord,
}: ReportRecordListProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  if (!records.length) return <p>这一期没有已确认的收支账单。</p>;
  return (
    <>
      {records
        .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
        .map((record) =>
          onRecord ? (
            <button
              type="button"
              className="report-record"
              key={record.id}
              onClick={() => onRecord(record)}
            >
              <span>
                <strong>{record.merchant || "未填写商户"}</strong>
                <small>
                  {record.date.slice(0, DATE_KEY_LENGTH)} · {record.kind}
                </small>
              </span>
              <strong>
                {record.kind === "支出" ? "−" : "+"}¥{money(record.amount)}
              </strong>
            </button>
          ) : (
            <p key={record.id}>
              {record.date.slice(0, DATE_KEY_LENGTH)} ·{" "}
              {record.merchant || "未填写商户"} · {record.kind} ¥
              {money(record.amount)}
            </p>
          ),
        )}
      {pageCount > 1 ? (
        <div className="report-record-pages">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            上一页
          </button>
          <span>
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            下一页
          </button>
        </div>
      ) : null}
    </>
  );
}
