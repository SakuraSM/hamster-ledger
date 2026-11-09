import { describe, expect, it } from "vitest";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { reportGroups, type BillRecord } from "@hamster-ledger/core";
import {
  cashFlowBuckets,
  cashFlowBucketRecords,
  reportDistribution,
  reportGroupRecords,
} from "../packages/ledger-core/src/report-visualization";

const template = createDemoLedger().records[0];
function record(
  input: Partial<BillRecord> &
    Pick<BillRecord, "id" | "date" | "kind" | "amount">,
): BillRecord {
  return { ...template, status: "confirmed", isDeleted: false, ...input };
}

describe("report visualization data", () => {
  it("fills daily gaps, handles leap days and follows the existing confirmed cash-flow rules", () => {
    const records = [
      record({
        id: "expense",
        date: "2024-02-28 12:00:00",
        kind: "支出",
        amount: 1000,
      }),
      record({
        id: "refund",
        date: "2024-02-28 13:00:00",
        kind: "退款",
        amount: 300,
      }),
      record({
        id: "income",
        date: "2024-03-02 12:00:00",
        kind: "收入",
        amount: 2000,
      }),
      record({
        id: "pending",
        date: "2024-02-29 12:00:00",
        kind: "支出",
        amount: 9999,
        status: "pending",
      }),
      record({
        id: "deleted",
        date: "2024-03-01 12:00:00",
        kind: "支出",
        amount: 9999,
        isDeleted: true,
      }),
      record({
        id: "transfer",
        date: "2024-03-01 12:00:00",
        kind: "转账",
        amount: 9999,
      }),
    ];
    const result = cashFlowBuckets({
      records,
      start: "2024-02-28",
      end: "2024-03-02",
    });
    expect(result.granularity).toBe("day");
    expect(
      result.rows.map(({ date, expense, income }) => [date, expense, income]),
    ).toEqual([
      ["2024-02-28", 700, 0],
      ["2024-02-29", 0, 0],
      ["2024-03-01", 0, 0],
      ["2024-03-02", 0, 2000],
    ]);
  });
  it("aggregates long ranges by calendar month without leaking records outside partial endpoints", () => {
    const records = [
      record({
        id: "outside",
        date: "2025-12-01 00:00:00",
        kind: "支出",
        amount: 9000,
      }),
      record({
        id: "inside",
        date: "2025-12-15 00:00:00",
        kind: "支出",
        amount: 1200,
      }),
      record({
        id: "refund",
        date: "2026-03-02 10:00:00",
        kind: "退款",
        amount: 500,
      }),
      record({
        id: "late",
        date: "2026-03-03 00:00:00",
        kind: "收入",
        amount: 9000,
      }),
    ];
    const result = cashFlowBuckets({
      start: "2025-12-15",
      end: "2026-03-02",
      records,
    });
    expect(result.granularity).toBe("month");
    expect(
      result.rows.map(({ date, expense, income }) => [date, expense, income]),
    ).toEqual([
      ["2025-12", 1200, 0],
      ["2026-01", 0, 0],
      ["2026-02", 0, 0],
      ["2026-03", -500, 0],
    ]);
    expect(
      cashFlowBucketRecords({
        records,
        date: "2025-12",
        start: "2025-12-15",
        end: "2026-03-02",
      }).map((item) => item.id),
    ).toEqual(["inside"]);
  });
  it("reports an overly broad range instead of silently truncating it", () => {
    const result = cashFlowBuckets({
      records: [],
      start: "2000-01-01",
      end: "2020-01-01",
    });
    expect(result.isRangeTooLarge).toBe(true);
    expect(result.rows).toEqual([]);
  });
  it("computes shares from positive groups without treating refund-only groups as positive spending", () => {
    const result = reportDistribution([
      { name: "餐饮", amount: 300 },
      { name: "交通", amount: 100 },
      { name: "购物", amount: -50 },
      { name: "空分类", amount: 0 },
    ]);
    expect(result.total).toBe(400);
    expect(result.slices.map(({ name, percent }) => [name, percent])).toEqual([
      ["餐饮", 75],
      ["交通", 25],
    ]);
    expect(result.hasNegativeGroups).toBe(true);
    const large = reportDistribution([
      { name: "标签一", amount: Number.MAX_SAFE_INTEGER },
      { name: "标签二", amount: Number.MAX_SAFE_INTEGER },
    ]);
    expect(large.total).toBeNull();
    expect(large.slices.map((slice) => slice.percent)).toEqual([50, 50]);
  });
  it("drills into the same confirmed category or tag records used by the distribution", () => {
    const records = [
      record({
        id: "food",
        date: "2026-10-01 08:00:00",
        kind: "支出",
        amount: 100,
        category: "餐饮",
        tags: ["朋友"],
      }),
      record({
        id: "refund",
        date: "2026-10-02 08:00:00",
        kind: "退款",
        amount: 30,
        category: "餐饮",
        tags: ["朋友"],
      }),
      record({
        id: "pending",
        date: "2026-10-03 08:00:00",
        kind: "支出",
        amount: 50,
        category: "餐饮",
        status: "pending",
      }),
      record({
        id: "other",
        date: "2026-10-04 08:00:00",
        kind: "收入",
        amount: 90,
        category: "餐饮",
      }),
    ];
    expect(
      reportGroupRecords({
        records,
        dimension: "category",
        kind: "支出",
        name: "餐饮",
      }).map((item) => item.id),
    ).toEqual(["refund", "food"]);
    expect(
      reportGroupRecords({
        records,
        dimension: "tag",
        kind: "支出",
        name: "朋友",
      }).map((item) => item.id),
    ).toEqual(["refund", "food"]);
    const repeated = [{ ...records[0], tags: ["朋友", "朋友"] }];
    expect(
      reportGroups({ records: repeated, dimension: "tag", kind: "支出" }),
    ).toEqual([{ name: "朋友", amount: 100 }]);
  });
});
