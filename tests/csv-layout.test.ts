import { expect, it } from "vitest";
import Papa from "papaparse";
import { summarize } from "@hamster-ledger/core";
import { createStatement, parseStatement } from "@hamster-ledger/importers";
import { readStatement } from "../apps/web/src/platform/browser/files";
import { alipayCsvFixture } from "./helpers/alipay-csv-fixture";
it("repairs Alipay CSV splitting before a manual column remap", async () => {
  const file = await readStatement(
    new File([alipayCsvFixture()], "alipay.csv"),
  );
  const remapped = {
    ...file,
    headerIndex: 10,
    mapping: {
      date: 2,
      amount: 9,
      merchant: 7,
      description: 8,
      direction: 10,
      status: 11,
      orderId: 0,
    },
    mappingConfirmed: true,
  };
  const result = parseStatement(remapped, {});
  expect(result.errors).toEqual([]);
  expect(result.records).toHaveLength(2);
  expect(result.records[0]).toMatchObject({
    date: "2026-10-01 12:00:00",
    amount: 1234,
    merchant: "合成商户",
    source: "支付宝",
    orderId: "ALI-QA-001",
  });
  expect(result.records[1]).toMatchObject({ kind: "退款", amount: 234 });
  expect(summarize(result.records)).toEqual({
    expense: 1000,
    income: 0,
    net: -1000,
  });
  expect(file.headerIndex).toBe(10);
  expect(parseStatement(file, {}).records).toHaveLength(2);
});
it.each(["\t", ";", "|"])(
  "finds a %j table after misleading comma-delimited introductory lines",
  async (delimiter) => {
    const file = await readStatement(
      new File([alipayCsvFixture(delimiter)], "alipay.csv"),
    );
    expect(parseStatement(file, {}).records).toHaveLength(2);
    expect(file.headerIndex).toBe(10);
  },
);
it("preserves quoted delimiters, newlines and long identifiers", async () => {
  const text = Papa.unparse([
    ["交易时间", "金额", "收支", "交易对方", "商品说明", "交易单号"],
    [
      "2026-10-01",
      "12.34",
      "支出",
      "合成,商户;门店|分店",
      '合成"备注"\n第二行\t内容',
      "202610010000000000000001",
    ],
  ]);
  const file = await readStatement(new File([text], "alipay.csv"));
  const result = parseStatement(file, {});
  expect(result.errors).toEqual([]);
  expect(result.records[0]).toMatchObject({
    merchant: "合成,商户;门店|分店",
    description: '合成"备注"\n第二行\t内容',
    orderId: "202610010000000000000001",
    amount: 1234,
  });
});
it("rejects malformed quoting instead of choosing a separator that hides it", async () => {
  await expect(
    readStatement(
      new File(
        ['交易时间,金额,收支,交易对方\n2026-10-01,12.34,支出,"未闭合'],
        "alipay.csv",
      ),
    ),
  ).rejects.toThrow("引号");
});
it("explains a zero-record result when the selected header has no following transactions", () => {
  const file = createStatement({
    name: "alipay.csv",
    hash: "empty-table",
    rows: [
      ["交易时间", "金额", "收支"],
      ["合计", "12.34", ""],
    ],
  });
  expect(parseStatement(file, {})).toEqual({
    records: [],
    errors: ["表头之后没有可识别的交易明细，请核对表头所在行或重新导出账单。"],
  });
});
