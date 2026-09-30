import {
  type BillRecord,
  type Category,
  type Ledger,
  type Source,
} from "@hamster-ledger/core";

function makeDemoRecord(
  input: Partial<BillRecord> &
    Pick<BillRecord, "id" | "amount" | "merchant" | "date">,
): BillRecord {
  return {
    description: input.merchant,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "支付宝",
    account: "招商银行 · 6628",
    orderId: input.id,
    status: "confirmed",
    sourceStatus: "交易成功",
    fileName: "示例账单.csv",
    raw: { 说明: "此记录为虚拟示例" },
    linkedSources: [],
    ...input,
  };
}
export function createDemoLedger(): Ledger {
  const records: BillRecord[] = [
    makeDemoRecord({
      id: "demo-coffee",
      amount: 1800,
      merchant: "瑞幸咖啡",
      date: "2026-09-30 10:24:18",
      linkedSources: ["招商银行"],
    }),
    makeDemoRecord({
      id: "demo-market",
      amount: 12680,
      merchant: "盒马鲜生",
      date: "2026-09-29 18:32:00",
      category: "购物",
    }),
    makeDemoRecord({
      id: "demo-salary",
      amount: 1850000,
      merchant: "工资收入",
      date: "2026-09-28 12:00:00",
      category: "工资",
      kind: "收入",
      source: "招商银行",
    }),
    makeDemoRecord({
      id: "demo-metro",
      amount: 600,
      merchant: "地铁出行",
      date: "2026-09-28 08:15:00",
      category: "交通",
      source: "微信支付",
      account: "微信零钱",
    }),
  ];
  const categoryPlans: Array<{
    category: Category;
    remaining: number;
    merchant: string;
    source: Source;
  }> = [
    {
      category: "购物",
      remaining: 304140,
      merchant: "生活采购",
      source: "支付宝",
    },
    {
      category: "餐饮",
      remaining: 232360,
      merchant: "日常用餐",
      source: "微信支付",
    },
    {
      category: "居住",
      remaining: 189200,
      merchant: "房租与水电",
      source: "招商银行",
    },
    {
      category: "交通",
      remaining: 123450,
      merchant: "通勤出行",
      source: "支付宝",
    },
  ];
  const weights = [
    8, 10, 14, 44, 23, 5, 7, 12, 3, 8, 8, 5, 9, 8, 11, 12, 4, 3, 7, 21, 13, 5,
    8, 10, 3, 21, 16,
  ];
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  for (const plan of categoryPlans) {
    let remaining = plan.remaining;
    weights.forEach((weight, index) => {
      const amount =
        index === weights.length - 1
          ? remaining
          : Math.floor((plan.remaining * weight) / weightTotal);
      remaining -= amount;
      records.push(
        makeDemoRecord({
          id: `demo-${plan.category}-${index}`,
          merchant: plan.merchant,
          category: plan.category,
          source: plan.source,
          amount,
          date: `2026-09-${String(index + 1).padStart(2, "0")} 12:30:00`,
        }),
      );
    });
  }
  const reviewSamples = [
    ["星巴克", 3600],
    ["盒马鲜生", 12680],
    ["京东商城", 29900],
    ["滴滴出行", 4260],
    ["网易云音乐", 1800],
    ["社区便利店", 2800],
  ] as const;
  const reviews = reviewSamples.map(([merchant, amount], index) => {
    const leftId = `pending-left-${index}`;
    const rightId = `pending-right-${index}`;
    const date = `2026-09-${String(30 - index).padStart(2, "0")} 10:24:`;
    records.push(
      makeDemoRecord({
        id: leftId,
        amount,
        merchant,
        date: date + "18",
        status: "pending",
      }),
    );
    records.push(
      makeDemoRecord({
        id: rightId,
        amount,
        merchant: "支付宝特约商户",
        date: date + "22",
        source: "招商银行",
        status: "pending",
      }),
    );
    return {
      id: `review-${index}`,
      leftId,
      rightId,
      state: "pending" as const,
      reasons: ["金额相同", "付款账户一致", "交易时间相差 4 秒"],
    };
  });
  return { version: 1, records, reviews, rules: {}, files: [] };
}
