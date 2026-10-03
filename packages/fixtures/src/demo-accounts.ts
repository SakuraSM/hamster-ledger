import type { AssetAccount } from "@hamster-ledger/core";
const BASELINE_AT = "2026-09-01 00:00:00";
export function createDemoAccounts(): AssetAccount[] {
  const examples: Array<
    Pick<
      AssetAccount,
      "id" | "name" | "kind" | "type" | "openingBalance" | "aliases"
    >
  > = [
    {
      id: "demo-bank",
      name: "测试账户甲",
      kind: "asset",
      type: "银行卡",
      openingBalance: 91000,
      aliases: ["测试付款方式甲"],
    },
    {
      id: "demo-wechat",
      name: "测试账户乙",
      kind: "asset",
      type: "网络钱包",
      openingBalance: 163500,
      aliases: [],
    },
    {
      id: "demo-investment",
      name: "测试账户丙",
      kind: "asset",
      type: "投资",
      openingBalance: 132500,
      aliases: ["测试付款方式丙"],
    },
    {
      id: "demo-credit",
      name: "测试账户丁",
      kind: "liability",
      type: "信用卡",
      openingBalance: 48500,
      aliases: [],
    },
  ];
  return examples.map((account) => ({
    ...account,
    balanceAt: BASELINE_AT,
    isArchived: false,
    checkpoints: [
      {
        id: account.id + "-initial",
        balance: account.openingBalance,
        at: BASELINE_AT,
        note: "虚拟资产示例",
        recordedAt: BASELINE_AT,
      },
    ],
  }));
}
