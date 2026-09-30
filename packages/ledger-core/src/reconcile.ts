const MATCH_WINDOW_DAYS = 2;
const HOURS_PER_DAY = 24;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const NEARBY_TIME_WINDOW_MS = 60000;
import {
  type BillRecord,
  type Ledger,
  type Review,
  RECORD_STATUS,
  REVIEW_STATUS,
} from "./model.js";

const MATCH_WINDOW_MS =
  MATCH_WINDOW_DAYS *
  HOURS_PER_DAY *
  SECONDS_PER_MINUTE *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;
export function exactKey(record: BillRecord): string | null {
  if (!record.orderId) return null;
  return [
    record.source,
    record.account,
    record.orderId,
    record.amount,
    record.currency,
    record.kind,
    record.sourceStatus,
  ].join("|");
}
export function findMatchReasons(
  left: BillRecord,
  right: BillRecord,
): string[] {
  if (
    left.source === right.source ||
    left.amount !== right.amount ||
    left.currency !== right.currency ||
    left.kind !== right.kind
  )
    return [];
  if (left.kind !== "支出" || !left.account || left.account !== right.account)
    return [];
  const hasBankSide = [left.source, right.source].some(
    (source) => source === "招商银行" || source === "其他银行",
  );
  if (!hasBankSide) return [];
  const difference = Math.abs(
    Date.parse(left.date.replace(" ", "T")) -
      Date.parse(right.date.replace(" ", "T")),
  );
  if (!Number.isFinite(difference) || difference > MATCH_WINDOW_MS) return [];
  return [
    "金额相同",
    "付款账户一致",
    difference < NEARBY_TIME_WINDOW_MS ? "交易时间接近" : "交易日与入账日接近",
  ];
}
export interface ImportPlan {
  ledger: Ledger;
  added: number;
  duplicate: number;
  pending: number;
}
export function planImport(
  existing: Ledger,
  incoming: BillRecord[],
): ImportPlan {
  const records = existing.records.map((record) => ({
    ...record,
    linkedSources: [...record.linkedSources],
  }));
  const reviews = existing.reviews.map((review) => ({ ...review }));
  const used = new Set(
    reviews.flatMap((review) => [review.leftId, review.rightId]),
  );
  const keys = new Map(
    records
      .map((record) => [exactKey(record), record])
      .filter(([key]) => key !== null) as [string, BillRecord][],
  );
  let duplicate = 0;
  for (const rawRecord of incoming) {
    const record = {
      ...rawRecord,
      linkedSources: [...rawRecord.linkedSources],
    };
    const key = exactKey(record);
    const prior = key ? keys.get(key) : undefined;
    if (prior) {
      records.push({
        ...record,
        status: RECORD_STATUS.DUPLICATE,
        duplicateOf: prior.id,
        reason: "同来源、账户、流水号与金额一致",
      });
      duplicate++;
      continue;
    }
    const candidates = records.filter(
      (candidate) =>
        candidate.status !== RECORD_STATUS.DUPLICATE &&
        !used.has(candidate.id) &&
        findMatchReasons(candidate, record).length > 0,
    );
    if (candidates.length === 1) {
      const candidate = candidates[0];
      reviews.push({
        id: `match-${record.id}`,
        leftId: candidate.id,
        rightId: record.id,
        state: REVIEW_STATUS.PENDING,
        reasons: findMatchReasons(candidate, record),
      });
      // Existing confirmed spending remains counted until the user makes a decision.
      record.status = RECORD_STATUS.PENDING;
      record.reason = "疑似跨平台重复，等待核对";
      used.add(candidate.id);
      used.add(record.id);
    }
    if (candidates.length > 1) {
      record.status = RECORD_STATUS.PENDING;
      record.reason = "存在多笔相同金额候选，请逐笔核对";
    }
    records.push(record);
    if (key) keys.set(key, record);
  }
  const incomingIds = new Set(incoming.map((record) => record.id));
  const addedRecords = records.filter((record) => incomingIds.has(record.id));
  return {
    ledger: { ...existing, records, reviews },
    duplicate,
    added: addedRecords.filter(
      (record) => record.status === RECORD_STATUS.CONFIRMED,
    ).length,
    pending: addedRecords.filter(
      (record) => record.status === RECORD_STATUS.PENDING,
    ).length,
  };
}
export function resolveReview(input: {
  ledger: Ledger;
  review: Review;
  decision: "linked" | "separate";
}): Ledger {
  const { ledger, review, decision } = input;
  const left = ledger.records.find((record) => record.id === review.leftId);
  const right = ledger.records.find((record) => record.id === review.rightId);
  if (!left || !right) throw new Error("找不到原始账单，请重新打开核对。");
  const isBankLeft = left.source === "招商银行" || left.source === "其他银行";
  const kept = isBankLeft ? right : left;
  const linked = isBankLeft ? left : right;
  const records = ledger.records.map((record) => {
    if (record.id === kept.id)
      return {
        ...record,
        status: RECORD_STATUS.CONFIRMED,
        linkedSources:
          decision === REVIEW_STATUS.LINKED
            ? [...new Set([...record.linkedSources, linked.source])]
            : record.linkedSources,
      };
    if (record.id === linked.id)
      return {
        ...record,
        status:
          decision === REVIEW_STATUS.LINKED
            ? RECORD_STATUS.DUPLICATE
            : RECORD_STATUS.CONFIRMED,
        duplicateOf: decision === REVIEW_STATUS.LINKED ? kept.id : undefined,
      };
    return record;
  });
  return {
    ...ledger,
    records,
    reviews: ledger.reviews.map((item) =>
      item.id === review.id ? { ...item, state: decision } : item,
    ),
  };
}
