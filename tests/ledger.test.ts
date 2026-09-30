import { describe, it, expect } from "vitest";
import { createDemoLedger } from "../apps/web/src/data/demo";
import { EMPTY_LEDGER, summarize, type BillRecord } from "@hamster-ledger/core";
import {
  parseAmount,
  parseDate,
  parseStatement,
  mapHeaders,
  type StatementFile,
} from "@hamster-ledger/importers";
import { planImport, resolveReview } from "@hamster-ledger/core";

function sample(overrides: Partial<BillRecord> = {}): BillRecord {
  return {
    id: "left",
    date: "2026-09-30 10:24:18",
    merchant: "咖啡",
    description: "咖啡",
    amount: 3600,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "支付宝",
    account: "招商银行 · 6628",
    orderId: "ALI-1",
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "test.csv",
    raw: {},
    linkedSources: [],
    ...overrides,
  };
}
function statement(rows: string[][]): StatementFile {
  return {
    name: "test.csv",
    hash: "hash",
    rows,
    headerIndex: 0,
    mapping: mapHeaders(rows[0]),
    source: "招商银行",
    account: "",
  };
}

describe("金额与日期边界", () => {
  it("使用整数分而非浮点元计价", () => {
    expect(parseAmount("¥1,234.56")).toBe(123456);
    expect(parseAmount("0.29")).toBe(29);
    expect(parseAmount("2.999")).toBeNull();
  });
  it("拒绝错误日期与超范围时间", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("2026-09-30 24:01:00")).toBeNull();
    expect(parseDate("20260930")).toBe("2026-09-30 00:00:00");
  });
});
describe("导入解析", () => {
  it("银行收入不被零支出列覆盖", () => {
    const result = parseStatement(
      statement([
        ["日期", "交易对方", "收入", "支出"],
        ["2026-09-30", "公司", "18500.00", "0.00"],
      ]),
      {},
    );
    expect(result.errors).toEqual([]);
    expect(result.records[0]).toMatchObject({ amount: 1850000, kind: "收入" });
  });
  it("保留退款及转账语义", () => {
    const result = parseStatement(
      statement([
        ["日期", "交易对方", "金额", "收支方向", "摘要"],
        ["2026-09-30", "京东", "28.00", "收入", "商品退款"],
        ["2026-09-30", "招行", "2000.00", "支出", "信用卡还款"],
      ]),
      {},
    );
    expect(result.records.map((record) => record.kind)).toEqual([
      "退款",
      "转账",
    ]);
    expect(summarize(result.records)).toEqual({
      expense: -2800,
      income: 0,
      net: 2800,
    });
  });
  it("未知收支进入待确认而不是猜测", () => {
    const result = parseStatement(
      statement([
        ["日期", "交易对方", "金额"],
        ["2026-09-30", "商户", "36.00"],
      ]),
      {},
    );
    expect(result.records[0].status).toBe("pending");
    expect(summarize(result.records).expense).toBe(0);
  });
  it("外币和错误行不会混入人民币汇总", () => {
    const result = parseStatement(
      statement([
        ["日期", "交易对方", "金额", "收支方向", "币种"],
        ["2026-09-30", "商户", "10.00", "支出", "USD"],
        ["bad", "商户", "36.00", "支出", "CNY"],
      ]),
      {},
    );
    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });
  it("同商户使用用户保存的分类规则", () => {
    const result = parseStatement(
      statement([
        ["日期", "交易对方", "金额", "收支方向"],
        ["2026-09-30", "星巴克", "36", "支出"],
      ]),
      { 星巴克: "其他" },
    );
    expect(result.records[0].category).toBe("其他");
  });
});
describe("重复识别与收支汇总", () => {
  it("同源相同订单只计算一次", () => {
    const plan = planImport(EMPTY_LEDGER, [sample(), sample({ id: "second" })]);
    expect(plan.duplicate).toBe(1);
    expect(summarize(plan.ledger.records).expense).toBe(3600);
  });
  it("无订单号的同源同额交易不会误合并", () => {
    const plan = planImport(EMPTY_LEDGER, [
      sample({ orderId: "" }),
      sample({ id: "second", orderId: "" }),
    ]);
    expect(plan.duplicate).toBe(0);
    expect(summarize(plan.ledger.records).expense).toBe(7200);
  });
  it("跨平台匹配等待确认，并保留已确认的支出", () => {
    const plan = planImport({ ...EMPTY_LEDGER, records: [sample()] }, [
      sample({ id: "bank", source: "招商银行", orderId: "BANK-1" }),
    ]);
    expect(plan.pending).toBe(1);
    expect(plan.ledger.reviews).toHaveLength(1);
    expect(summarize(plan.ledger.records).expense).toBe(3600);
    const resolved = resolveReview({
      ledger: plan.ledger,
      review: plan.ledger.reviews[0],
      decision: "linked",
    });
    expect(summarize(resolved.records).expense).toBe(3600);
    expect(resolved.records).toHaveLength(2);
    expect(resolved.records[0].linkedSources).toEqual(["招商银行"]);
  });
  it("付款卡号不一致不能成为自动候选", () => {
    const plan = planImport(EMPTY_LEDGER, [
      sample(),
      sample({ id: "bank", source: "招商银行", account: "招商银行 · 8888" }),
    ]);
    expect(plan.ledger.reviews).toHaveLength(0);
  });
  it("保留为两笔后分别计入", () => {
    const plan = planImport(EMPTY_LEDGER, [
      sample(),
      sample({ id: "bank", source: "招商银行" }),
    ]);
    const resolved = resolveReview({
      ledger: plan.ledger,
      review: plan.ledger.reviews[0],
      decision: "separate",
    });
    expect(summarize(resolved.records).expense).toBe(7200);
  });
  it("多笔同额候选留待核对，不能随意关联第一笔", () => {
    const plan = planImport(EMPTY_LEDGER, [
      sample(),
      sample({ id: "other", orderId: "ALI2" }),
      sample({ id: "bank", source: "招商银行" }),
    ]);
    expect(plan.ledger.reviews).toHaveLength(0);
    expect(plan.ledger.records[2].status).toBe("pending");
  });
  it("示例总额与设计图一致且待核对记录不计入", () => {
    expect(summarize(createDemoLedger().records)).toEqual({
      expense: 864230,
      income: 1850000,
      net: 985770,
    });
  });
});
