import { Button } from "@mantine/core";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
import {
  usePendingReview,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { Choice } from "../ui/Choice";

interface PendingReviewPanelProps {
  controller: LedgerController;
  onSelect: (record: BillRecord) => void;
}
export function PendingReviewPanel({
  controller,
  onSelect,
}: PendingReviewPanelProps): React.JSX.Element | null {
  const review = usePendingReview(controller);
  const record = review.record;
  const candidate = review.candidate;
  if (!record) return null;
  const index = review.records.indexOf(record);
  return (
    <section className="panel" aria-label="待确认流水">
      <h2>待确认流水 · {review.records.length} 笔</h2>
      <p>
        多笔相似候选或尚未确认的流水，需要你选择关联对象，或确认为独立账单。
      </p>
      <div className="button-row">
        <span>
          第 {index + 1} / {review.records.length} 笔
        </span>
        <Button
          variant="subtle"
          disabled={review.isBusy || index === 0}
          onClick={() => review.selectRecord(review.records[index - 1].id)}
        >
          上一笔待确认
        </Button>
        <Button
          variant="subtle"
          disabled={review.isBusy || index === review.records.length - 1}
          onClick={() => review.selectRecord(review.records[index + 1].id)}
        >
          下一笔待确认
        </Button>
      </div>
      <h3>
        {record.merchant} · {signedMoney(record)}
      </h3>
      <p>
        {record.source} · {record.date} · {record.account || "未提供账户"}
      </p>
      <p className="muted">{record.reason || "尚未计入收支。"}</p>
      <Button variant="subtle" onClick={() => onSelect(record)}>
        查看待确认原始流水
      </Button>
      {review.candidates.length ? (
        <>
          <Choice
            label="选择要关联的流水"
            value={review.candidate?.id ?? ""}
            disabled={review.isBusy}
            onChange={review.selectCandidate}
            limit={30}
          >
            <option value="">请核对后选择，不会自动关联</option>
            {review.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.merchant} · {candidate.source} · {candidate.date} ·{" "}
                {signedMoney(candidate)}
              </option>
            ))}
          </Choice>
          {candidate ? (
            <Button variant="subtle" onClick={() => onSelect(candidate)}>
              查看候选原始流水
            </Button>
          ) : null}
        </>
      ) : (
        <p>当前没有符合关联条件的已入账流水。请先核对金额、类型和账户。</p>
      )}
      <p className="muted">
        确认为独立账单后，将按当前收支类型计入汇总；关联后只计一次，原始流水均保留。
      </p>
      <div className="button-row">
        <Button
          disabled={review.isBusy || !review.candidate}
          onClick={() => void review.resolve("link")}
        >
          关联所选流水
        </Button>
        <Button
          variant="outline"
          disabled={review.isBusy}
          onClick={() => void review.resolve("confirm")}
        >
          确认为独立账单
        </Button>
      </div>
      {review.error ? (
        <p className="error-message" role="alert">
          {review.error}
        </p>
      ) : null}
    </section>
  );
}
