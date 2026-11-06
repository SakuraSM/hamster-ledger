import { addMinor } from "./currency.js";
import { dateSchema } from "./date-schemas.js";
import type { BillRecord, Ledger } from "./model.js";

const DATE_KEY_LENGTH = 10;
export interface ReimbursementReportRow {
  record: BillRecord;
  returns: BillRecord[];
  laterReturns: BillRecord[];
  anomalies: BillRecord[];
  hasConflict: boolean;
  received: number | null;
  outstanding: number | null;
  currentAvailable: number | null;
}
export interface ReimbursementReport {
  rows: ReimbursementReportRow[];
  received: number | null;
  outstanding: number | null;
}
interface RelatedReturns {
  returns: BillRecord[];
  laterReturns: BillRecord[];
  anomalies: BillRecord[];
}
function isConfirmed(record: BillRecord): boolean {
  return record.status === "confirmed" && !record.isDeleted;
}
function relatedReturns(
  ledger: Ledger,
  end: string,
): Map<string, RelatedReturns> {
  const result = new Map<string, RelatedReturns>();
  for (const record of ledger.records) {
    const detail = record.detail;
    if (!isConfirmed(record) || !detail?.relatedId) continue;
    const isRefundKind = record.kind === "退款";
    const isRefundType = ["refund", "reimburse"].includes(detail.type);
    if (!isRefundKind && !isRefundType) continue;
    const related = result.get(detail.relatedId) ?? {
      returns: [],
      laterReturns: [],
      anomalies: [],
    };
    if (record.duplicateOf || isRefundKind !== isRefundType)
      related.anomalies.push(record);
    else if (record.date.slice(0, DATE_KEY_LENGTH) > end)
      related.laterReturns.push(record);
    else related.returns.push(record);
    result.set(detail.relatedId, related);
  }
  return result;
}
function total(records: BillRecord[]): number {
  return records.reduce((sum, record) => addMinor(sum, record.amount), 0);
}
export function reimbursementReport(input: {
  ledger: Ledger;
  start: string;
  end: string;
}): ReimbursementReport {
  const { ledger, start, end } = input;
  const report: ReimbursementReport = { rows: [], received: 0, outstanding: 0 };
  if (
    !dateSchema.safeParse(start).success ||
    !dateSchema.safeParse(end).success ||
    start > end
  )
    return report;
  const grouped = relatedReturns(ledger, end);
  for (const record of ledger.records) {
    const date = record.date.slice(0, DATE_KEY_LENGTH);
    if (
      !isConfirmed(record) ||
      record.kind !== "支出" ||
      !record.detail?.isReimbursable ||
      date < start ||
      date > end
    )
      continue;
    const related = grouped.get(record.id) ?? {
      returns: [],
      laterReturns: [],
      anomalies: [],
    };
    const hasConflict = Boolean(
      record.duplicateOf ||
      !["expense", "fee"].includes(record.detail.type) ||
      related.anomalies.length,
    );
    if (hasConflict) {
      report.rows.push({
        record,
        ...related,
        hasConflict,
        received: null,
        outstanding: null,
        currentAvailable: null,
      });
      report.received = null;
      report.outstanding = null;
      continue;
    }
    const received = total(related.returns);
    const outstanding = Math.max(0, addMinor(record.amount, -received));
    const currentReceived = addMinor(received, total(related.laterReturns));
    const currentAvailable = Math.max(
      0,
      addMinor(record.amount, -currentReceived),
    );
    report.rows.push({
      record,
      ...related,
      hasConflict,
      received,
      outstanding,
      currentAvailable,
    });
    if (report.received !== null)
      report.received = addMinor(report.received, received);
    if (report.outstanding !== null)
      report.outstanding = addMinor(report.outstanding, outstanding);
  }
  return report;
}
