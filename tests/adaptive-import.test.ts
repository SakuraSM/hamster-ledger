import { expect, it } from "vitest";
import Papa from "papaparse";
import { createStatement, parseStatement } from "@hamster-ledger/importers";
import { summarize } from "@hamster-ledger/core";
import { readStatement } from "../apps/web/src/platform/browser/files";
import { ledgerExportRows } from "./helpers/statement-fixture";
it("imports a CSV ledger export with ten introductory rows and preserves its fields", async () => {
  const file = await readStatement(
    new File([Papa.unparse(ledgerExportRows())], "alipay-ledger.csv", {
      type: "text/csv",
    }),
  );
  expect(file.headerIndex).toBe(10);
  const result = parseStatement(file, {});
  expect(result.errors).toEqual([]);
  expect(result.records).toHaveLength(4);
  expect(result.records[0]).toMatchObject({
    date: "2026-09-30 12:00:00",
    amount: 1234,
    merchant: "合成午餐",
    category: "日常餐费",
    source: "支付宝",
    account: "合成现金账户",
    tags: ["日常", "午餐"],
  });
  expect(result.records[1].kind).toBe("不计收支");
  expect(result.records[0].raw.来源).toBe("账单同步");
  expect(summarize(result.records).expense).toBe(12034);
});
it("locates the actual header beyond the old hundred-row limit", () => {
  const rows = [
    ...Array.from({ length: 110 }, () => ["支付宝导出说明"]),
    ...ledgerExportRows().slice(10),
  ];
  const file = createStatement({
    name: "export.csv",
    hash: "late-header",
    rows,
  });
  expect(file.headerIndex).toBe(110);
  expect(parseStatement(file, {}).records).toHaveLength(4);
});
it("suggests unique date, money and direction columns from data but keeps them pending until reviewed", () => {
  const file = createStatement({
    name: "custom.csv",
    hash: "custom",
    rows: [
      ["发生时点", "交易对方", "本次发生数", "业务标记", "订单号"],
      ["2026-09-30 12:00:00", "合成商户", "12.34", "支出", "12345678"],
      ["2026-09-29 12:00:00", "合成商户", "5.60", "支出", "98765432"],
    ],
  });
  expect(file.mapping).toMatchObject({
    date: 0,
    merchant: 1,
    amount: 2,
    direction: 3,
    orderId: 4,
  });
  expect(file).toMatchObject({
    reviewFields: expect.arrayContaining(["date", "amount", "direction"]),
  });
  expect(
    parseStatement(file, {}).records.every(
      (record) => record.status === "pending",
    ),
  ).toBe(true);
  const reviewed = { ...file, mappingConfirmed: true };
  expect(
    parseStatement(reviewed, {}).records.every(
      (record) => record.status === "confirmed",
    ),
  ).toBe(true);
});
it("does not choose between ambiguous numeric columns or guess from transaction identifiers", () => {
  const file = createStatement({
    name: "unknown.csv",
    hash: "ambiguous",
    rows: [
      ["交易时间", "值一", "值二", "订单号", "收支"],
      ["2026-09-30", "12.34", "5.60", "12345678", "支出"],
    ],
  });
  expect(file.mapping.amount).toBeUndefined();
  expect(parseStatement(file, {}).records).toHaveLength(0);
  const manual = {
    ...file,
    mapping: { ...file.mapping, amount: 1 },
    mappingConfirmed: true,
  };
  expect(parseStatement(manual, {}).records[0].amount).toBe(1234);
});
it("skips repeated headers and totals while still reporting malformed transaction rows", () => {
  const rows = ledgerExportRows();
  rows.push(
    rows[10].slice(0, -1),
    ["合计", "", "", "620.34"],
    ["invalid-date", "日常餐费", "支出", "12.34", "合成错误行"],
  );
  const file = createStatement({ name: "alipay.csv", hash: "repeated", rows });
  const result = parseStatement(file, {});
  expect(result.records).toHaveLength(4);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain("交易日期");
});

it("rejects a blank CSV after preserving blank lines for row selection", async () => {
  await expect(
    readStatement(new File(["\n, ,\n"], "blank.csv")),
  ).rejects.toThrow("文件没有可读取的内容");
});
it("keeps both original values for duplicate headers and requires a mapping review", () => {
  const file = createStatement({
    name: "duplicate.csv",
    hash: "duplicate-columns",
    rows: [
      ["日期", "金额", "金额", "收支"],
      ["2026-09-30", "12.34", "56.78", "支出"],
    ],
  });
  expect(file).toMatchObject({ reviewFields: ["amount"] });
  const records = parseStatement(
    {
      ...file,
      mappingConfirmed: true,
      mapping: { ...file.mapping, amount: 2 },
    },
    {},
  ).records;
  expect(records[0].amount).toBe(5678);
  expect(records[0].raw).toMatchObject({
    "金额（第2列）": "12.34",
    "金额（第3列）": "56.78",
  });
});
it("retains saved category rules ahead of an imported category hint", () => {
  const file = createStatement({
    name: "alipay.csv",
    hash: "category",
    rows: ledgerExportRows(),
  });
  expect(
    parseStatement(file, { 合成午餐: "自定义规则分类" }).records[0].category,
  ).toBe("自定义规则分类");
});

it("does not silently consume the first transaction as a missing header", () => {
  const file = createStatement({
    name: "no-header.csv",
    hash: "no-header",
    rows: [
      ["2026-09-30", "12.34", "支出"],
      ["2026-09-29", "5.60", "支出"],
    ],
  });
  expect(parseStatement(file, {}).records).toHaveLength(0);
  expect(parseStatement(file, {}).errors).toEqual([
    "请设置交易时间和金额字段。",
  ]);
});

it("does not hide an invalid transaction whose merchant begins with a summary word", () => {
  const file = createStatement({
    name: "reordered.csv",
    hash: "summary-name",
    rows: [
      ["交易对方", "日期", "金额", "收支"],
      ["合计便利店", "invalid-date", "12.34", "支出"],
    ],
  });
  expect(parseStatement(file, {}).errors).toHaveLength(1);
});

it("recognizes explicit transfer and refund directions without guessing from the description", () => {
  const file = createStatement({
    name: "ledger.csv",
    hash: "explicit-kind",
    rows: [
      ["记录时间", "金额", "收支类型", "备注", "状态"],
      ["2026-09-30", "20.00", "退款", "合成售后", "成功"],
      ["2026-09-29", "100.00", "转账", "合成资金记录", "成功"],
      ["2026-09-28", "30.00", "退款", "合成失败记录", "失败"],
    ],
  });
  const result = parseStatement(file, {});
  expect(result.records.map((record) => record.kind)).toEqual([
    "退款",
    "转账",
    "不计收支",
  ]);
  expect(result.records.every((record) => record.status === "confirmed")).toBe(
    true,
  );
  expect(summarize(result.records)).toEqual({
    expense: -2000,
    income: 0,
    net: 2000,
  });
});
