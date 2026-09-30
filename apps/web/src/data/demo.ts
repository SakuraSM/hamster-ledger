/* eslint no-magic-numbers: "off" */
// Explicit synthetic fixture amounts and distribution weights.
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
    account: "测试账户甲",
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
      amount: 1275,
      merchant: "测试便利店",
      date: "2026-09-30 10:24:18",
      linkedSources: ["招商银行"],
    }),
    makeDemoRecord({
      id: "demo-market",
      amount: 2850,
      merchant: "测试出行",
      date: "2026-09-29 18:32:00",
      category: "购物",
    }),
    makeDemoRecord({
      id: "demo-salary",
      amount: 420000,
      merchant: "测试收入",
      date: "2026-09-28 12:00:00",
      category: "工资",
      kind: "收入",
      source: "招商银行",
    }),
    makeDemoRecord({
      id: "demo-metro",
      amount: 6325,
      merchant: "测试缴费",
      date: "2026-09-28 08:15:00",
      category: "交通",
      source: "微信支付",
      account: "测试账户乙",
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
      remaining: 41250,
      merchant: "测试餐厅",
      source: "支付宝",
    },
    {
      category: "餐饮",
      remaining: 52500,
      merchant: "测试商场",
      source: "微信支付",
    },
    {
      category: "居住",
      remaining: 13725,
      merchant: "测试公交",
      source: "招商银行",
    },
    {
      category: "交通",
      remaining: 23500,
      merchant: "测试家用",
      source: "支付宝",
    },
  ];
  const weights = Array.from({ length: 27 }, (_, day) => 3 + ((day * 7) % 13));
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
    ["测试商户甲", 725],
    ["测试商户乙", 915],
    ["测试商户丙", 1450],
    ["测试商户丁", 1725],
    ["测试商户戊", 2125],
    ["测试商户己", 2375],
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
        merchant: "测试对账商户",
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
  return {
    version: 1,
    records,
    reviews,
    rules: {},
    files: [],
  };
}
