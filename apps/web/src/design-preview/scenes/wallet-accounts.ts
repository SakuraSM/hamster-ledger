import type { SceneSpec } from "../model";
export const walletAccountScenes: SceneSpec[] = [
  {
    id: "wallet-accounts",
    title: "网络钱包",
    group: "资产与报表",
    nav: "mine",
    subtitle: "2 个独立账户 · 合计 ¥1,720.00",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "支付宝",
            value: "¥1,234.00",
            note: "基准2,464.40 · 已确认变动−1,230.40",
            icon: "wallet",
            target: "account-records",
          },
          {
            label: "微信",
            value: "¥486.00",
            note: "基准486.00 · 无基准后变动",
            icon: "wallet",
            target: "account-records",
          },
        ],
      },
      {
        kind: "notice",
        text: "这里只汇总各钱包的实际账户余额。支付平台的通知本身不能证明实际出资账户。",
      },
    ],
    actions: [
      { label: "添加钱包账户", target: "account-edit" },
      { label: "返回全部资产", target: "assets", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountGroup.tsx",
      "apps/mobile/src/screens/AssetAccountList.tsx",
    ],
    intent:
      "手机端按账户类型收拢显示，进入后仍能追溯每个独立账户的基准与变化。",
  },
];
