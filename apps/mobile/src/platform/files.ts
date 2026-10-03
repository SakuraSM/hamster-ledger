import { DATE_PART_WIDTH, CENTS_PER_YUAN } from "../constants";
const HEX_RADIX = 16;
const JSON_INDENT_SPACES = 2;
import * as DocumentPicker from "expo-document-picker";
import { File, Directory, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import Papa from "papaparse";
import { decodeStatementText } from "./statement-encoding";
import * as XLSX from "xlsx";
import * as codepages from "xlsx/dist/cpexcel.full.mjs";
import {
  createStatement,
  MAX_FILE_ROWS,
  type StatementFile,
} from "@hamster-ledger/importers";
import { ledgerSchema, type Ledger } from "@hamster-ledger/core";
const MAX_STATEMENT_BYTES = 10_485_760;
const MAX_BACKUP_BYTES = 20_971_520;
XLSX.set_cptable(codepages);
function excelCell(value: unknown): string {
  if (!(value instanceof Date)) return String(value ?? "");
  if (!Number.isFinite(value.getTime()))
    throw new Error("Excel 日期单元格无效。");
  const pad = (part: number): string =>
    String(part).padStart(DATE_PART_WIDTH, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
export async function pickStatements(): Promise<
  DocumentPicker.DocumentPickerAsset[]
> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: true,
    copyToCacheDirectory: true,
  });
  return result.canceled ? [] : result.assets;
}
export async function readStatement(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<StatementFile> {
  const file = new File(asset.uri);
  try {
    if (file.size > MAX_STATEMENT_BYTES)
      throw new Error("文件超过 10 MB，请按月拆分后导入。");
    const bytes = await file.bytes();
    const digest = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytes,
    );
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(HEX_RADIX).padStart(DATE_PART_WIDTH, "0"),
    ).join("");
    let rows: string[][];
    if (/\.csv$/i.test(asset.name)) {
      const text = decodeStatementText(bytes);
      const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
      if (result.errors.some((error) => error.type === "Quotes"))
        throw new Error("CSV 引号格式有误，请重新导出。");
      rows = result.data.map((row) => row.map((value) => value.trim()));
    } else if (/\.xlsx?$/i.test(asset.name)) {
      const workbook = XLSX.read(bytes, {
        type: "array",
        cellDates: true,
        sheetRows: MAX_FILE_ROWS + 1,
      });
      if (workbook.SheetNames.length !== 1)
        throw new Error("请每次导入一个工作表。");
      rows = XLSX.utils
        .sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], {
          header: 1,
          raw: true,
          defval: "",
        })
        .map((row) => row.map(excelCell));
    } else throw new Error("请选择 CSV、XLSX 或 XLS 账单。");
    return createStatement({ name: asset.name, hash, rows });
  } finally {
    removePickerCopy(file);
  }
}
export async function pickBackup(): Promise<Ledger | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  try {
    if (file.size > MAX_BACKUP_BYTES)
      throw new Error("备份超过 20 MB，请在 Web 端拆分账本后恢复。");
    return ledgerSchema.parse(JSON.parse(await file.text()));
  } finally {
    removePickerCopy(file);
  }
}
export async function shareBackup(ledger: Ledger): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("此设备暂不支持系统分享。");
  const file = createExportFile("完整备份.json");
  file.write(
    JSON.stringify(ledgerSchema.parse(ledger), null, JSON_INDENT_SPACES),
  );
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "保存或分享账本备份",
  });
}
export async function shareExcel(ledger: Ledger): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("此设备暂不支持系统分享。");
  const rows = ledger.records
    .filter((record) => !record.isDeleted)
    .map((record) => ({
      日期: record.date,
      商户: record.merchant,
      金额: record.amount / CENTS_PER_YUAN,
      收支: record.kind,
      分类: record.category,
      账户: record.account,
      来源: record.source,
      备注: record.description,
      标签: record.tags?.join("，"),
      状态: record.status,
    }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "账单",
  );
  const file = createExportFile("账单.xlsx");
  file.write(
    new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" })),
  );
  await Sharing.shareAsync(file.uri, {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    dialogTitle: "导出 Excel",
  });
}

const EXPORT_RETENTION_MS = 86_400_000;
function removePickerCopy(file: File): void {
  if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
}
function createExportFile(name: string): File {
  const directory = new Directory(Paths.cache, "ledger-exports");
  directory.create({ intermediates: true, idempotent: true });
  for (const item of directory.list()) {
    if (
      item instanceof File &&
      item.modificationTime !== null &&
      Date.now() - item.modificationTime > EXPORT_RETENTION_MS
    )
      item.delete();
  }
  // Receivers may read the shared URI after the chooser closes. Keep it until a later export.
  return new File(directory, `仓鼠记账-${Date.now()}-${name}`);
}
