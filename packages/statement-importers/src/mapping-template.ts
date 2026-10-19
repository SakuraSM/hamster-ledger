import { STORAGE_PREFIX, type KeyValueStore } from "@hamster-ledger/core";
import { FIELDS, type FieldMap } from "./fields.js";
import { validateMapping } from "./mapping.js";
import type { StatementFile, ParseResult } from "./statement-model.js";
function templateKey(file: StatementFile): string {
  return (
    STORAGE_PREFIX +
    "import-mapping.v1:" +
    JSON.stringify([
      file.source,
      file.rows[file.headerIndex].map((cell) => cell.trim()),
    ])
  );
}
export async function rememberMapping(
  store: KeyValueStore,
  file: StatementFile,
): Promise<void> {
  const error = validateMapping(file);
  if (error) throw new Error(error);
  await store.setItem(templateKey(file), JSON.stringify(file.mapping));
}
export async function reuseMapping(
  store: KeyValueStore,
  file: StatementFile,
): Promise<StatementFile> {
  const raw = await store.getItem(templateKey(file));
  if (!raw) return file;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("已保存的字段模板损坏，请重新核对字段。");
    const mapping: FieldMap = {};
    for (const field of FIELDS) {
      const column = (value as Record<string, unknown>)[field];
      if (column !== undefined) {
        if (
          typeof column !== "number" ||
          !Number.isInteger(column) ||
          column < 0
        )
          throw new Error("已保存的字段模板损坏，请重新核对字段。");
        mapping[field] = column;
      }
    }
    // Same headers do not prove the data has the same meaning. Keep confirmation mandatory.
    const result = {
      ...file,
      mapping,
      reviewFields: [...FIELDS],
      mappingConfirmed: false,
    };
    if (validateMapping(result)) return file;
    return result;
  } catch {
    return file;
  }
}
export function importErrorReport(
  items: Array<{ file: StatementFile } & ParseResult>,
): string {
  return items
    .filter((item) => item.errors.length)
    .map(({ file, errors }) =>
      [
        `文件：${file.name}`,
        `文件指纹：${file.hash}`,
        `表头：${JSON.stringify(file.rows[file.headerIndex])}`,
        ...errors.map((error) => {
          const row = /第\s+(\d+)\s+行/.exec(error);
          return (
            error +
            (row
              ? `\n原始行：${JSON.stringify(file.rows[Number(row[1]) - 1])}`
              : "")
          );
        }),
      ].join("\n"),
    )
    .join("\n\n");
}
