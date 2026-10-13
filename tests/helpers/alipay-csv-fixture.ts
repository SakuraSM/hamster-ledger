import Papa from "papaparse";
export const alipayCsvHeaders = [
  "交易号",
  "商家订单号",
  "交易创建时间",
  "付款时间",
  "最近修改时间",
  "交易来源地",
  "类型",
  "交易对方",
  "商品名称",
  "金额（元）",
  "收/支",
  "交易状态",
];
export function alipayCsvFixture(delimiter = ","): string {
  const rows = [
    alipayCsvHeaders,
    [
      "ALI-QA-001",
      "SHOP-QA-001",
      "2026-10-01 12:00:00",
      "2026-10-01 12:00:00",
      "2026-10-01 12:00:00",
      "支付宝",
      "即时到账",
      "合成商户",
      "合成午餐",
      "12.34",
      "支出",
      "交易成功",
    ],
    [
      "ALI-QA-002",
      "SHOP-QA-002",
      "2026-10-02 12:00:00",
      "2026-10-02 12:00:00",
      "2026-10-02 12:00:00",
      "支付宝",
      "即时到账",
      "合成商户",
      "合成退款",
      "2.34",
      "收入",
      "退款成功",
    ],
  ];
  const preamble =
    delimiter === ","
      ? "支付宝账单说明\t请保留原格式"
      : "支付宝账单说明,请保留原格式";
  const table = Papa.unparse(
    rows.map((row, index) =>
      index && delimiter === "," ? row.map((value) => value + "\t") : row,
    ),
    { delimiter, newline: "\r\n" },
  );
  return [...Array.from({ length: 10 }, () => preamble), table].join("\r\n");
}
