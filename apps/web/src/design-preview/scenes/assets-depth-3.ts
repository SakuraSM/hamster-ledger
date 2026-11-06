import type { SceneSpec } from "../model";
export const assetDepthScenes3: SceneSpec[] = [
  {
    id: "investment-account",
    title: "投资账户，记录你核对的值",
    group: "资产与报表",
    nav: "mine",
    subtitle: "独立投资示例 · 手动估值",
    hero: "¥12,000.00",
    heroLabel: "最近核对估值",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "最近确认时间", value: "11月6日 16:00", icon: "calendar" },
          {
            label: "估值说明",
            note: "由你填写实际核对值，不接入实时行情",
            icon: "shield",
          },
          {
            label: "历史基准",
            value: "查看",
            icon: "clock",
            target: "account-history",
          },
        ],
      },
      {
        kind: "notice",
        text: "更新估值会保留新的余额基准，不会把估值变化伪装成一笔消费。",
      },
    ],
    actions: [{ label: "核对新的估值", target: "calibration" }],
    sources: [
      "apps/web/src/components/assets/AccountEditor.tsx",
      "apps/mobile/src/screens/AccountEditor.tsx",
    ],
    intent: "使用已有投资账户与校准能力，不虚构实时行情或自动收益预测。",
  },
];
