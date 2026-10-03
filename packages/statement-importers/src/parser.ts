import { parseAmount, parseDate } from "./parseValues.js";
export { parseAmount, parseDate } from "./parseValues.js";
import {
  type BillRecord,
  type Category,
  RECORD_STATUS,
} from "@hamster-ledger/core";
import {
  classifyCategory,
  classifyKind,
  identifySource,
  normalizeAccount,
} from "@hamster-ledger/core";

import { cleanHeader, type Field } from "./fields.js";
import { detectStatementLayout } from "./detection.js";
import { mappingNeedsReview, validateMapping } from "./mapping.js";
import {
  MAX_FILE_ROWS,
  type StatementFile,
  type ParseResult,
} from "./statement-model.js";
export {
  MAX_FILE_ROWS,
  type StatementFile,
  type ParseResult,
} from "./statement-model.js";
export function createStatement(input: {
  name: string;
  hash: string;
  rows: string[][];
}): StatementFile {
  const { name, hash, rows } = input;
  if (rows.length > MAX_FILE_ROWS)
    throw new Error("单次最多读取 15,000 行，请拆分账单。");
  if (!rows.some((row) => row.some((value) => value.trim())))
    throw new Error("文件没有可读取的内容。");
  const { headerIndex, mapping, reviewFields } = detectStatementLayout(rows);
  const source = identifySource(
    name +
      " " +
      rows
        .slice(0, headerIndex + 1)
        .flat()
        .join(" "),
  );
  return {
    name: name,
    hash,
    rows,
    headerIndex,
    mapping,
    reviewFields,
    mappingConfirmed: reviewFields.length === 0,
    source,
    account: "",
  };
}
function parseRow(input: {
  file: StatementFile;
  row: string[];
  index: number;
  rules: Record<string, Category>;
}): BillRecord {
  const { file, row, index, rules } = input;
  const field = (key: Field): string => {
    const column = file.mapping[key];
    return column === undefined ? "" : (row[column] ?? "").trim();
  };
  const date = parseDate(field("date"));
  if (!date) throw new Error("交易日期缺失或格式错误");
  const expense = parseAmount(field("expense"));
  const income = parseAmount(field("income"));
  const amount =
    parseAmount(field("amount")) ??
    (expense !== null && expense > 0 ? expense : (income ?? expense));
  if (amount === null) throw new Error("金额缺失或不是有效人民币金额");
  const currency = field("currency");
  if (currency && !/^(CNY|RMB|人民币|人民币元|元|156)$/i.test(currency))
    throw new Error("当前仅支持人民币账单，请单独处理外币交易");
  const description = field("description");
  const merchant = field("merchant") || description || "未知商户";
  const sourceStatus = field("status") || "已导入";
  const direction =
    field("direction") ||
    (expense !== null && expense > 0
      ? "支出"
      : income !== null && income > 0
        ? "收入"
        : "");
  const identifiedKind = classifyKind({
    direction,
    description: merchant + " " + description,
    sourceStatus,
  });
  const category = classifyCategory({
    text: merchant + " " + description,
    hint: field("category"),
    rules,
    preserveHint: true,
  });
  const raw = Object.fromEntries(
    Array.from(
      { length: Math.max(file.rows[file.headerIndex].length, row.length) },
      (_, column) => {
        const header =
          file.rows[file.headerIndex][column]?.trim() || `列${column + 1}`;
        const duplicate =
          file.rows[file.headerIndex].filter((value) => value.trim() === header)
            .length > 1;
        return [
          duplicate ? `${header}（第${column + 1}列）` : header,
          row[column] ?? "",
        ];
      },
    ),
  );
  const needsMappingReview = mappingNeedsReview(file);
  const isPending = identifiedKind === null || needsMappingReview;
  return {
    id: `${file.hash}-${index}`,
    date,
    merchant,
    description,
    amount,
    currency: "CNY",
    kind: identifiedKind ?? "不计收支",
    category,
    source: file.source,
    account: normalizeAccount(field("account") || file.account, file.source),
    orderId: field("orderId"),
    status: isPending ? RECORD_STATUS.PENDING : RECORD_STATUS.CONFIRMED,
    sourceStatus,
    fileName: file.name,
    raw,
    linkedSources: [],
    tags: [
      ...new Set(
        field("tags")
          .split(/[,，;；、\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ],
    reason: needsMappingReview
      ? "字段映射尚未确认"
      : isPending
        ? "收支方向未识别，请确认交易类型"
        : undefined,
  };
}
export function parseStatement(
  file: StatementFile,
  rules: Record<string, Category>,
): ParseResult {
  const records: BillRecord[] = [];
  const errors: string[] = [];
  const mappingError = validateMapping(file);
  if (mappingError) return { records, errors: [mappingError] };
  file.rows.slice(file.headerIndex + 1).forEach((row, offset) => {
    const headers = file.rows[file.headerIndex];
    const isRepeatedHeader =
      headers.every(
        (header, column) =>
          cleanHeader(header) === cleanHeader(row[column] ?? ""),
      ) && row.slice(headers.length).every((value) => !value.trim());
    const firstCell = row.find((value) => value.trim())?.trim() ?? "";
    const hasDate = parseDate(row[file.mapping.date ?? 0] ?? "") !== null;
    const isSummary =
      !hasDate &&
      /^(?:[-—_]{3,}$|(?:合计|总计|导出时间|统计时间)(?:\s|[:：]|$)|共\s*\d+\s*笔|收入.*笔.*支出)/.test(
        firstCell,
      );
    if (row.every((value) => !value.trim()) || isRepeatedHeader || isSummary)
      return;
    const index = file.headerIndex + offset + 1;
    try {
      records.push(parseRow({ file, row, index, rules }));
    } catch (error) {
      errors.push(
        `第 ${index + 1} 行：${error instanceof Error ? error.message : "读取失败"}`,
      );
    }
  });
  return { records, errors };
}
