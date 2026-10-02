const CENTS_PER_YUAN = 100;
import Papa from "papaparse";
import { type BillRecord, money } from "@hamster-ledger/core";
const DOWNLOAD_URL_LIFETIME_MS = 1000;
export function downloadFile(input: {
  name: string;
  text: string;
  type: string;
}): void {
  const url = URL.createObjectURL(new Blob([input.text], { type: input.type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}
export function exportRecords(records: BillRecord[]): void {
  const rows = records.map((record) => ({
    交易时间: record.date,
    交易对方: record.merchant,
    金额: money(record.amount).replaceAll(",", ""),
    收支方向: record.kind,
    分类: record.category,
    付款账户: record.account,
    来源: record.source,
    交易单号: record.orderId,
    处理状态: record.status,
    关联来源: record.linkedSources.join("、"),
  }));
  downloadFile({
    name: "仓鼠记账-账单.csv",
    text: "\uFEFF" + Papa.unparse(rows, { escapeFormulae: true }),
    type: "text/csv;charset=utf-8",
  });
}
export async function exportExcel(records: BillRecord[]): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = records.map((record) => ({
    交易时间: record.date,
    商户: record.merchant,
    金额: record.amount / CENTS_PER_YUAN,
    类型: record.kind,
    分类: record.category,
    账户: record.account,
    备注: record.description,
    标签: record.tags?.join("、") ?? "",
    状态: record.status,
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "账单");
  XLSX.writeFile(book, "仓鼠记账-账单.xlsx");
}
