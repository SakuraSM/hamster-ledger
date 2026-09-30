import Papa from "papaparse";
import {
  createStatement,
  MAX_FILE_ROWS,
  type StatementFile,
} from "@hamster-ledger/importers";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const HEX_RADIX = 16;
const TWO_DIGITS = 2;
export async function readStatement(file: File): Promise<StatementFile> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error("文件超过 10 MB，请按月拆分后导入。");
  const buffer = await file.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    (byte) => byte.toString(HEX_RADIX).padStart(TWO_DIGITS, "0"),
  ).join("");
  let rows: string[][];
  if (/\.csv$/i.test(file.name)) {
    const utf8 = new TextDecoder("utf-8").decode(buffer);
    const text = utf8.includes("\uFFFD")
      ? new TextDecoder("gb18030").decode(buffer)
      : utf8;
    const result = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    if (result.errors.some((error) => error.type === "Quotes"))
      throw new Error("CSV 引号格式有误，请重新导出账单。");
    rows = result.data.map((row) => row.map((value) => value.trim()));
  } else if (/\.xlsx?$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      sheetRows: MAX_FILE_ROWS + 1,
    });
    if (workbook.SheetNames.length !== 1)
      throw new Error("此文件包含多个工作表，请每次导入一个账单工作表。");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils
      .sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        dateNF: "yyyy-mm-dd hh:mm:ss",
      })
      .map((row) => row.map(String));
  } else {
    throw new Error("当前支持 CSV、XLSX 和 XLS。PDF 账单请先转换为表格。");
  }
  return createStatement({ name: file.name, hash, rows });
}
