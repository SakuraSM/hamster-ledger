import {
  RECORD_STATUS,
  type BillRecord,
  type Kind,
} from "@hamster-ledger/core";
export const AMOUNT_TONES = {
  INCOME: "income",
  EXPENSE: "expense",
  NEUTRAL: "neutral",
} as const;
export type AmountTone = (typeof AMOUNT_TONES)[keyof typeof AMOUNT_TONES];
const KIND_TONES: Record<Kind, AmountTone> = {
  收入: AMOUNT_TONES.INCOME,
  退款: AMOUNT_TONES.INCOME,
  支出: AMOUNT_TONES.EXPENSE,
  转账: AMOUNT_TONES.NEUTRAL,
  不计收支: AMOUNT_TONES.NEUTRAL,
};
export function recordAmountTone(record: BillRecord): AmountTone {
  if (
    record.isDeleted ||
    record.status !== RECORD_STATUS.CONFIRMED ||
    record.amount === 0
  )
    return AMOUNT_TONES.NEUTRAL;
  return KIND_TONES[record.kind];
}
