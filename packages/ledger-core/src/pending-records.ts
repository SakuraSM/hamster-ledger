import { assertRecordUnchanged } from "./record-conflicts.js";
import { findMatchReasons, resolveReview } from "./reconcile.js";
import type { BillRecord, Ledger, Review } from "./model.js";

/** Includes ambiguous imports that have no pair in the review queue yet. */
export function unpairedPendingRecords(ledger: Ledger): BillRecord[] {
  const paired = new Set(
    ledger.reviews
      .filter((review) => review.state === "pending")
      .flatMap((review) => [review.leftId, review.rightId]),
  );
  return ledger.records.filter(
    (record) =>
      !record.isDeleted &&
      record.status === "pending" &&
      !paired.has(record.id),
  );
}

export function pendingReviewCount(ledger: Ledger): number {
  return (
    ledger.reviews.filter((review) => review.state === "pending").length +
    unpairedPendingRecords(ledger).length
  );
}

export function pendingMatchCandidates(
  ledger: Ledger,
  record: BillRecord,
): BillRecord[] {
  const used = new Set(
    ledger.reviews.flatMap((review) => [review.leftId, review.rightId]),
  );
  return ledger.records.filter(
    (candidate) =>
      candidate.id !== record.id &&
      !candidate.isDeleted &&
      candidate.status === "confirmed" &&
      !used.has(candidate.id) &&
      findMatchReasons(candidate, record).length > 0,
  );
}

export type PendingRecordDecision = {
  record: BillRecord;
} & ({ decision: "confirm" } | { decision: "link"; candidate: BillRecord });

export function resolvePendingRecord(
  ledger: Ledger,
  input: PendingRecordDecision,
): Ledger {
  const current = ledger.records.find(
    (record) => record.id === input.record.id,
  );
  assertRecordUnchanged({ current, expected: input.record });
  if (
    !current ||
    !unpairedPendingRecords(ledger).some((record) => record.id === current.id)
  )
    throw new Error("这笔待确认账单已变化，请重新打开核对。");
  if (input.decision === "confirm") {
    return {
      ...ledger,
      records: ledger.records.map((record) =>
        record.id === current.id
          ? { ...record, status: "confirmed", reason: undefined }
          : record,
      ),
    };
  }
  const candidate = ledger.records.find(
    (record) => record.id === input.candidate.id,
  );
  assertRecordUnchanged({ current: candidate, expected: input.candidate });
  if (
    !candidate ||
    !pendingMatchCandidates(ledger, current).some(
      (record) => record.id === candidate.id,
    )
  )
    throw new Error("候选账单已变化或不符合关联条件，请重新选择。");
  const review: Review = {
    id: `manual-match-${current.id}-${candidate.id}`,
    leftId: candidate.id,
    rightId: current.id,
    state: "pending",
    reasons: findMatchReasons(candidate, current),
  };
  if (ledger.reviews.some((item) => item.id === review.id))
    throw new Error("这组流水已有核对结果，请刷新后重试。");
  return resolveReview({
    ledger: { ...ledger, reviews: [...ledger.reviews, review] },
    review,
    decision: "linked",
  });
}
