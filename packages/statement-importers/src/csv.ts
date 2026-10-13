import { detectStatementLayout } from "./detection.js";
import { mapHeaders, type Field } from "./fields.js";
import { parseAmount, parseDate } from "./parseValues.js";
import { MAX_FILE_ROWS } from "./statement-model.js";
const CSV_DELIMITERS = [",", "\t", ";", "|", "\u001e", "\u001f"];
const SAMPLE_ROWS = 5;
const MONEY_FIELDS: Field[] = ["amount", "income", "expense"];
interface CsvResult {
  data: string[][];
  errors: ReadonlyArray<{ type: string }>;
}
interface CsvInput {
  text: string;
  parse: (options: { delimiter: string; preview: number }) => CsvResult;
}
function layoutRank(rows: string[][]): number[] {
  const { headerIndex, mapping } = detectStatementLayout(rows);
  const known = mapHeaders(rows[headerIndex] ?? []);
  const moneyColumns = MONEY_FIELDS.flatMap((field) =>
    mapping[field] === undefined ? [] : [mapping[field]],
  );
  const hasDate = mapping.date !== undefined;
  const supported = rows
    .slice(headerIndex + 1, headerIndex + SAMPLE_ROWS + 1)
    .filter(
      (row) =>
        hasDate &&
        parseDate(row[mapping.date ?? 0] ?? "") !== null &&
        moneyColumns.some((column) => parseAmount(row[column] ?? "") !== null),
    ).length;
  return [
    Number(hasDate && moneyColumns.length > 0),
    Number(known.date !== undefined) +
      Number(MONEY_FIELDS.some((field) => known[field] !== undefined)),
    Object.keys(known).length,
    supported,
  ];
}
function outranks(candidate: number[], current: number[]): boolean {
  for (let index = 0; index < candidate.length; index++) {
    if (candidate[index] !== current[index])
      return candidate[index] > current[index];
  }
  return false;
}
export function parseCsvRows({ text, parse }: CsvInput): string[][] {
  let best:
    { rows: string[][]; rank: number[]; hasQuoteError: boolean } | undefined;
  for (const delimiter of CSV_DELIMITERS) {
    if (delimiter !== "," && !text.includes(delimiter)) continue;
    const result = parse({ delimiter, preview: MAX_FILE_ROWS + 1 });
    const rows = result.data.map((row) => row.map((value) => value.trim()));
    const rank = layoutRank(rows);
    if (!best || outranks(rank, best.rank)) {
      best = {
        rows,
        rank,
        hasQuoteError: result.errors.some((error) => error.type === "Quotes"),
      };
    }
  }
  if (!best) throw new Error("CSV 没有可读取的内容。");
  if (best.hasQuoteError) throw new Error("CSV 引号格式有误，请重新导出账单。");
  return best.rows;
}
