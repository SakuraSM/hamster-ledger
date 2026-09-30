import { describe, it, expect } from "vitest";
import { createStatement, parseStatement } from "@hamster-ledger/importers";
describe("native-compatible statement input", () => {
  it("accepts platform-neutral rows and a caller-provided file hash", () => {
    const file = createStatement({
      name: "wechat.csv",
      hash: "native-sha256",
      rows: [
        ["微信支付账单"],
        ["交易时间", "交易对方", "金额", "收/支"],
        ["2026-09-30 10:00:00", "地铁出行", "6.00", "支出"],
      ],
    });
    const result = parseStatement(file, {});
    expect(file.headerIndex).toBe(1);
    expect(result.records[0]).toMatchObject({
      id: "native-sha256-2",
      amount: 600,
      source: "微信支付",
      category: "交通",
    });
  });
  it("does not need File, Blob, localStorage or React to import the package", () => {
    expect("window" in globalThis).toBe(false);
    expect(() =>
      createStatement({ name: "empty.csv", hash: "hash", rows: [] }),
    ).toThrow("文件没有可读取的内容");
  });
});
