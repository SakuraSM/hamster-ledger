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
      name: "招商银行 · 6628",
      kind: "asset",
      type: "银行卡",
      openingBalance: 5000000,
      aliases: ["招行 · 6628"],
    },
    {
      id: "demo-wechat",
      name: "微信零钱",
      kind: "asset",
      type: "网络钱包",
      openingBalance: 120000,
      aliases: [],
    },
    {
      id: "demo-investment",
      name: "投资账户",
      kind: "asset",
      type: "投资",
      openingBalance: 7000000,
      aliases: ["证券账户"],
    },
    {
      id: "demo-credit",
      name: "信用卡 · 8899",
      kind: "liability",
      type: "信用卡",
      openingBalance: 650000,
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
