import { FIELD_LABELS, type Field } from "./fields.js";
import { suggestMapping } from "./detection.js";
import type { StatementFile } from "./statement-model.js";
const PREVIEW_ROWS = 3;
const PREVIEW_LENGTH = 40;
const MONEY_FIELDS: Field[] = ["amount", "income", "expense"];
export function mappingNeedsReview(file: StatementFile): boolean {
  return Boolean(file.reviewFields?.length && !file.mappingConfirmed);
}
export function validateMapping(file: StatementFile): string | null {
  if (
    !Number.isInteger(file.headerIndex) ||
    file.headerIndex < 0 ||
    file.headerIndex >= file.rows.length
  )
    return "表头行超出文件范围。";
  if (
    file.mapping.date === undefined ||
    !MONEY_FIELDS.some((field) => file.mapping[field] !== undefined)
  )
    return "请设置交易时间和金额字段。";
  const width = Math.max(...file.rows.map((row) => row.length));
  for (const [field, column] of Object.entries(file.mapping)) {
    if (
      column !== undefined &&
      (!Number.isInteger(column) || column < 0 || column >= width)
    )
      return `${FIELD_LABELS[field as Field]}的列设置无效。`;
  }
  const required = [
    file.mapping.date,
    ...MONEY_FIELDS.map((field) => file.mapping[field]),
  ].filter((column) => column !== undefined);
  if (new Set(required).size !== required.length)
    return "交易时间和各金额字段不能指向同一列。";
  return null;
}
export function changeHeader(
  file: StatementFile,
  headerIndex: number,
): StatementFile {
  if (
    !Number.isInteger(headerIndex) ||
    headerIndex < 0 ||
    headerIndex >= file.rows.length
  )
    throw new Error("表头行超出文件范围。");
  const layout = suggestMapping({ rows: file.rows, headerIndex });
  return {
    ...file,
    ...layout,
    mappingConfirmed: layout.reviewFields.length === 0,
  };
}
export function mappingColumns(
  file: StatementFile,
): Array<{ index: number; header: string; example: string; label: string }> {
  const width = Math.max(...file.rows.map((row) => row.length));
  return Array.from({ length: width }, (_, index) => {
    const header = file.rows[file.headerIndex]?.[index]?.trim() || "空白表头";
    const example =
      file.rows
        .slice(file.headerIndex + 1, file.headerIndex + PREVIEW_ROWS + 1)
        .map((row) => row[index]?.trim())
        .find(Boolean)
        ?.slice(0, PREVIEW_LENGTH) ?? "";
    return {
      index,
      header,
      example,
      label: `第 ${index + 1} 列 · ${header}${example ? ` · 例：${example}` : ""}`,
    };
  });
}
