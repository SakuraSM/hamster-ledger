import type { BillRecord, Source } from "./model.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MATCH_WINDOW_DAYS = 2;
const AMBIGUOUS_CANDIDATE_COUNT = 2;
const BANK_SOURCES = new Set<Source>(["招商银行", "其他银行"]);

function matchKey(record: BillRecord): string {
  return JSON.stringify([record.account, record.amount, record.currency]);
}

function transactionDay(record: BillRecord): number {
  return Math.floor(Date.parse(record.date.replace(" ", "T")) / DAY_MS);
}

/** A coarse index only. The caller still applies the exact matching rules. */
export function createImportMatchIndex(input: {
  records: BillRecord[];
  isCandidate: (candidate: BillRecord, incoming: BillRecord) => boolean;
}): {
  add: (record: BillRecord) => void;
  candidates: (incoming: BillRecord) => BillRecord[];
} {
  const groups = new Map<string, Map<Source, Map<number, BillRecord[]>>>();
  function add(record: BillRecord): void {
    if (
      record.isDeleted ||
      record.status === "duplicate" ||
      record.kind !== "支出" ||
      !record.account
    )
      return;
    const day = transactionDay(record);
    if (!Number.isFinite(day)) return;
    const key = matchKey(record);
    const sources =
      groups.get(key) ?? new Map<Source, Map<number, BillRecord[]>>();
    const days = sources.get(record.source) ?? new Map<number, BillRecord[]>();
    const records = days.get(day) ?? [];
    records.push(record);
    days.set(day, records);
    sources.set(record.source, days);
    groups.set(key, sources);
  }
  function candidates(incoming: BillRecord): BillRecord[] {
    if (incoming.kind !== "支出" || !incoming.account) return [];
    const sources = groups.get(matchKey(incoming));
    const day = transactionDay(incoming);
    if (!sources || !Number.isFinite(day)) return [];
    const matches: BillRecord[] = [];
    for (const [source, days] of sources) {
      if (
        source === incoming.source ||
        (!BANK_SOURCES.has(source) && !BANK_SOURCES.has(incoming.source))
      )
        continue;
      for (
        let offset = -MATCH_WINDOW_DAYS;
        offset <= MATCH_WINDOW_DAYS;
        offset++
      ) {
        for (const candidate of days.get(day + offset) ?? []) {
          if (!input.isCandidate(candidate, incoming)) continue;
          matches.push(candidate);
          if (matches.length === AMBIGUOUS_CANDIDATE_COUNT) return matches;
        }
      }
    }
    return matches;
  }
  input.records.forEach(add);
  return { add, candidates };
}
