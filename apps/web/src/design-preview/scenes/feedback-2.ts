import type { SceneSpec } from "../model";
export const feedbackScenes2: SceneSpec[] = [
  {
    id: "member-remove",
    title: "移除这位成员？",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "小周 · 和家人的账",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        text: "移除后不再拥有该账本的访问权限。历史操作记录与账单继续保留。",
      },
    ],
    actions: [
      { label: "确认移除成员", target: "members" },
      { label: "取消", target: "member-role", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "成员移除与账单删除使用不同措辞与影响说明。",
  },
  {
    id: "debt-paid",
    title: "这次还款已记好",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "小林 · 本次归还 ¥200.00",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "累计已还", value: "¥400.00" },
          { label: "剩余待还", value: "¥200.00" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "本次归还不计作收入。可以继续查看关联记录。",
      },
    ],
    actions: [{ label: "查看借贷", target: "debts" }],
    sources: [
      "apps/web/src/components/finance/DebtsList.tsx",
      "apps/mobile/src/screens/DebtsList.tsx",
    ],
    intent: "用正确的还款后金额反馈结果。",
  },
];
