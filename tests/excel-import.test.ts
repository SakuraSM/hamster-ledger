import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readStatement } from "../apps/web/src/platform/browser/files";
import { parseStatement } from "@hamster-ledger/importers";

function excelFile(format: string): File {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["交易时间", "交易对方", "金额", "收/支", "支付方式"],
    [new Date(2026, 8, 30, 13, 5, 0), "地铁出行", 8, "支出", "零钱"],
  ]);
  sheet.A2.z = format;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "微信账单");
  const bytes: ArrayBuffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  });
  return new File([bytes], "wechat-date-cell.xlsx");
}

describe("Excel date cell import", () => {
  it.each(["m/d/yy", "yyyy年m月d日 h:mm", "yyyy-mm-dd hh:mm:ss"])(
    "reads date values independently of the display format %s",
    async (format) => {
      const file = await readStatement(excelFile(format));
      const result = parseStatement(file, {});
      expect(result.errors).toEqual([]);
      expect(result.records[0]).toMatchObject({
        date: "2026-09-30 13:05:00",
        amount: 800,
        source: "微信支付",
      });
    },
  );
});
