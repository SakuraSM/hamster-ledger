import type { SceneSpec } from "../model";
export const planningScenes2: SceneSpec[] = [
  {
    id: "debt-payment",
    title: "记下一次还款",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "小林 · 当前待还 ¥400.00",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "本次归还金额", value: "200.00" },
          { label: "收款账户", value: "工资卡", type: "select" },
          { label: "归还时间", value: "2026-11-06", type: "select" },
          { label: "备注", value: "第二次归还" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "保存后累计已还 ¥400.00，剩余 ¥200.00。还款不计作收入。",
      },
    ],
    actions: [{ label: "确认记录还款", target: "debt-paid" }],
    sources: [
      "apps/web/src/components/finance/FinanceFormDialog.tsx",
      "apps/mobile/src/screens/FinanceFormSheet.tsx",
    ],
    intent: "明确展示还款前后待还额与收支口径。",
  },
  {
    id: "goals",
    title: "把想要的生活，存起来",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "储蓄目标 · 每一步都算数",
    hero: "¥2,400.00",
    heroLabel: "旅行基金 · 已存",
    blocks: [
      {
        kind: "progress",
        heading: "周末去海边",
        value: "40",
        caption: "¥2,400.00 / ¥6,000.00",
      },
      {
        kind: "list",
        items: [
          { label: "还差", value: "¥3,600.00", icon: "target" },
          { label: "目标日期", value: "2027-03-01", icon: "calendar" },
          { label: "关联账户", value: "工资卡", icon: "wallet" },
        ],
      },
    ],
    actions: [
      { label: "记录一笔存入", target: "goal-contribute" },
      { label: "编辑目标", target: "goal-edit", secondary: true },
    ],
    sources: [
      "apps/web/src/components/finance/GoalsList.tsx",
      "apps/mobile/src/screens/GoalsList.tsx",
    ],
    intent: "用清楚的进度和差额表达目标，不添加虚构奖励或积分。",
  },
  {
    id: "finance-edit",
    title: "设置生活计划",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "按类型展开需要填写的内容",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "订阅", selected: true },
          { label: "借贷", target: "loan-edit" },
          { label: "储蓄目标", target: "goal-edit" },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "名称", value: "音乐会员" },
          { label: "金额", value: "18.00" },
          { label: "周期", value: "每月", type: "select" },
          { label: "下次发生", value: "2026-11-12", type: "select" },
          { label: "提前提醒", value: "1天", type: "select" },
        ],
      },
    ],
    actions: [{ label: "保存计划", target: "subscriptions" }],
    sources: [
      "apps/web/src/components/finance/FinanceFormDialog.tsx",
      "apps/mobile/src/screens/FinanceFormSheet.tsx",
    ],
    intent: "统一短表单骨架，不同计划只展示自己的字段。",
  },
  {
    id: "notifications",
    title: "值得留意的小事",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "2 条未读 · 全部提醒仍在这里",
    counter: "02",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "音乐会员即将续费",
            value: "¥18.00",
            note: "11月12日 · 提前提醒",
            icon: "bell",
            target: "subscriptions",
          },
          {
            label: "旅行基金有新进度",
            value: "40%",
            note: "已存 ¥2,400.00 / ¥6,000.00",
            icon: "target",
            target: "goals",
          },
          {
            label: "预算设置已更新",
            note: "已读 · 可用预算 ¥5,000.00",
            icon: "check",
            target: "budgets",
          },
        ],
      },
    ],
    actions: [
      { label: "全部标为已读", target: "notifications-read" },
      {
        label: "检查系统提醒",
        target: "reminder-diagnostics",
        secondary: true,
      },
    ],
    sources: [
      "apps/web/src/components/finance/PlanningPanel.tsx",
      "apps/mobile/src/screens/PlanningScreen.tsx",
    ],
    intent: "按事情组织通知，未读状态除了颜色还有文字；支持跳回对应对象。",
  },
];
