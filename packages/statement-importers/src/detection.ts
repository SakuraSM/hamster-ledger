import {
  FIELDS,
  mapHeaders,
  matchHeaderFields,
  type Field,
  type FieldMap,
} from "./fields.js";
import { parseDate, parseAmount } from "./parseValues.js";
const SAMPLE_ROWS = 5;
const MIN_HEADER_CELLS = 2;
const REQUIRED_VALUE_RATIO = 0.8;
const DATA_ROW_WEIGHT = 20;
const LABEL_WEIGHT = 4;
const REQUIRED_FIELD_WEIGHT = 4;
const MONEY_FIELDS: Field[] = ["amount", "income", "expense"];
const IDENTIFIER_OR_NON_PAYMENT =
  /单号|订单|流水|编号|序号|账号|账户|卡号|尾号|余额|手续费|利率|汇率|数量|笔数|id$|count|balance|fee|account|number|usd|美元|港币|欧元|日元/i;
export interface DetectedLayout {
  headerIndex: number;
  mapping: FieldMap;
  reviewFields: Field[];
}
function sampleRows(rows: string[][], headerIndex: number): string[][] {
  return rows
    .slice(headerIndex + 1, headerIndex + SAMPLE_ROWS + 1)
    .filter((row) => row.some((value) => value.trim()));
}
function isMoney(value: string): boolean {
  return parseDate(value) === null && parseAmount(value) !== null;
}
function candidates(input: {
  headers: string[];
  samples: string[][];
  mapping: FieldMap;
  accepts: (value: string) => boolean;
  money?: boolean;
}): number[] {
  const { headers, samples, mapping, accepts, money = false } = input;
  const used = new Set(Object.values(mapping));
  return headers.flatMap((header, column) => {
    if (used.has(column) || (money && IDENTIFIER_OR_NON_PAYMENT.test(header)))
      return [];
    const values = samples
      .map((row) => row[column]?.trim() ?? "")
      .filter(Boolean);
    return values.length &&
      values.filter(accepts).length / values.length >= REQUIRED_VALUE_RATIO
      ? [column]
      : [];
  });
}
export function suggestMapping(input: {
  rows: string[][];
  headerIndex: number;
}): DetectedLayout {
  const { rows, headerIndex } = input;
  const headers = rows[headerIndex] ?? [];
  const mapping = mapHeaders(headers);
  const matches = matchHeaderFields(headers);
  const reviewFields = FIELDS.filter(
    (field) => (matches[field]?.length ?? 0) > 1,
  );
  const samples = sampleRows(rows, headerIndex);
  const infer = (field: Field, accepts: (value: string) => boolean): void => {
    if (mapping[field] !== undefined) return;
    const possible = candidates({
      headers,
      samples,
      mapping,
      accepts,
      money: field === "amount",
    });
    if (possible.length === 1) {
      mapping[field] = possible[0];
      reviewFields.push(field);
    }
  };
  infer("date", (value) => parseDate(value) !== null);
  if (!MONEY_FIELDS.some((field) => mapping[field] !== undefined))
    infer("amount", isMoney);
  infer("direction", (value) =>
    /^(支出|收入|不计收支|退款|转账|income|expense|inflow|outflow)$/i.test(
      value,
    ),
  );
  return { headerIndex, mapping, reviewFields };
}
function supportCount(rows: string[][], layout: DetectedLayout): number {
  const { mapping, headerIndex } = layout;
  if (mapping.date === undefined) return 0;
  return sampleRows(rows, headerIndex).filter(
    (row) =>
      parseDate(row[mapping.date ?? 0] ?? "") !== null &&
      MONEY_FIELDS.some((field) => {
        const column = mapping[field];
        return column !== undefined && parseAmount(row[column] ?? "") !== null;
      }),
  ).length;
}
export function detectStatementLayout(rows: string[][]): DetectedLayout {
  let best: DetectedLayout = {
    headerIndex: 0,
    mapping: mapHeaders(rows[0] ?? []),
    reviewFields: [],
  };
  let bestScore = -1;
  rows.forEach((row, headerIndex) => {
    const cells = row.filter((value) => value.trim());
    if (
      cells.length < MIN_HEADER_CELLS ||
      cells.some((value) => parseDate(value) !== null)
    )
      return;
    const knownCount = Object.keys(mapHeaders(row)).length;
    if (!knownCount && cells.some(isMoney)) return;
    const layout = suggestMapping({ rows, headerIndex });
    const hasMoney = MONEY_FIELDS.some(
      (field) => layout.mapping[field] !== undefined,
    );
    const score =
      supportCount(rows, layout) * DATA_ROW_WEIGHT +
      knownCount * LABEL_WEIGHT +
      Number(layout.mapping.date !== undefined) * REQUIRED_FIELD_WEIGHT +
      Number(hasMoney) * REQUIRED_FIELD_WEIGHT -
      layout.reviewFields.length;
    if (score > bestScore) {
      best = layout;
      bestScore = score;
    }
  });
  return best;
}
