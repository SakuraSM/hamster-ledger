import type { SceneSpec } from "../model";
export const planningScenes1: SceneSpec[] = [
  {
    id: "budgets",
    title: "花得有余量",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "11月预算 · 与账本账期一致",
    hero: "¥3,713.60",
    heroLabel: "本期还可支出",
    blocks: [
      {
        kind: "progress",
        heading: "总预算",
        value: "26",
        caption: "已用 ¥1,286.40 / ¥5,000.00",
      },
      {
        kind: "metrics",
        items: [
          { label: "本期预算", value: "¥4,800.00" },
          { label: "上期结转", value: "¥200.00" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "餐饮预算",
            value: "¥748.00",
            note: "可用1000 · 已用252 · 分类预算独立查看",
            icon: "food",
            target: "budget-edit",
          },
          {
            label: "购物预算",
            value: "¥673.60",
            note: "可用1500 · 已用826.40",
            icon: "bag",
            target: "budget-edit",
          },
        ],
      },
    ],
    actions: [{ label: "调整预算", target: "budget-edit" }],
    sources: [
      "apps/web/src/components/planning/BudgetPage.tsx",
      "apps/mobile/src/screens/BudgetScreen.tsx",
    ],
    intent: "突出余量，并把本期预算与结转的组成说清楚。",
  },
  {
    id: "budget-edit",
    title: "给这段生活留预算",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "设置预算周期、范围与提醒",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "预算范围", value: "总预算", type: "select" },
          { label: "周期", value: "每月", type: "select" },
          { label: "预算金额", value: "4,800.00" },
          { label: "结转上期余量", value: "开启", type: "toggle" },
          { label: "提醒阈值", value: "80%", type: "select" },
        ],
      },
      { kind: "notice", text: "只结转正余额。本期可用额还会包含实际结转值。" },
    ],
    actions: [{ label: "保存预算", target: "budgets" }],
    sources: [
      "apps/web/src/components/planning/BudgetPage.tsx",
      "apps/mobile/src/screens/BudgetScreen.tsx",
    ],
    intent: "把金额、周期与结转安排在一张短表单中。",
  },
  {
    id: "recurring",
    title: "固定的事，记住就好",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "到期按规则补记，避免重复",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "房租",
            value: "¥2,500.00",
            note: "每月10日 · 工资卡 · 已启用",
            icon: "calendar",
            target: "recurring-edit",
          },
          {
            label: "工资",
            value: "¥8,500.00",
            note: "每月1日 · 收入 · 已启用",
            icon: "wallet",
            target: "recurring-edit",
          },
          {
            label: "健身",
            value: "¥100.00",
            note: "每月1日 · 已暂停",
            icon: "target",
            target: "recurring-edit",
          },
        ],
      },
      {
        kind: "notice",
        text: "本机账本需打开应用后执行。联网账本可由服务器调度。",
      },
    ],
    actions: [{ label: "新增周期记账", target: "recurring-edit" }],
    sources: [
      "apps/web/src/components/planning/RecurringPage.tsx",
      "apps/mobile/src/screens/RecurringScreen.tsx",
    ],
    intent: "每条规则只展示金额、频率、账户和是否启用。",
  },
  {
    id: "recurring-edit",
    title: "设置一笔周期账",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "固定支出 · 房租",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "交易名称", value: "房租" },
          { label: "金额", value: "2,500.00" },
          { label: "频率", value: "每月10日", type: "select" },
          { label: "付款账户", value: "工资卡", type: "select" },
          { label: "分类", value: "居住", type: "select" },
          { label: "启用规则", value: "开", type: "toggle" },
        ],
      },
    ],
    actions: [{ label: "保存周期规则", target: "recurring" }],
    sources: [
      "apps/web/src/components/planning/RecurringEditor.tsx",
      "apps/mobile/src/screens/RecurringEditor.tsx",
    ],
    intent: "把频率读成一句话，下一次发生时间可直接检查。",
  },
  {
    id: "subscriptions",
    title: "每月的小订阅",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "下次扣款，一眼看见",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "音乐会员",
            value: "¥18.00 / 月",
            note: "11月12日续费 · 提前1天提醒",
            icon: "bell",
            target: "finance-edit",
          },
          {
            label: "云盘",
            value: "¥25.00 / 月",
            note: "11月20日续费 · 提前3天提醒",
            icon: "globe",
            target: "finance-edit",
          },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "订阅提醒与实际扣款分开；实际发生后仍可核对对应账单。",
      },
    ],
    actions: [
      { label: "添加订阅", target: "finance-edit" },
      { label: "查看提醒", target: "notifications", secondary: true },
    ],
    sources: [
      "apps/web/src/components/finance/SubscriptionsList.tsx",
      "apps/mobile/src/screens/SubscriptionsList.tsx",
    ],
    intent: "用下次扣款日期排序，减少被静态订阅列表淹没。",
  },
  {
    id: "debts",
    title: "借与还，都说得清",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "借贷示例 · 与生活账汇总分开",
    blocks: [
      {
        kind: "choices",
        items: [{ label: "借出", selected: true }, { label: "借入" }],
      },
      {
        kind: "list",
        items: [
          {
            label: "小林 · 已归还一部分",
            value: "待还 ¥400.00",
            note: "借出600 · 已还200 · 11月30日到期",
            icon: "users",
            target: "debt-payment",
          },
        ],
      },
      {
        kind: "progress",
        heading: "还款进度",
        value: "33",
        caption: "已还 ¥200.00 / ¥600.00",
      },
    ],
    actions: [
      { label: "记录还款", target: "debt-payment" },
      { label: "新增借贷", target: "loan-edit", secondary: true },
    ],
    sources: [
      "apps/web/src/components/finance/DebtsList.tsx",
      "apps/mobile/src/screens/DebtsList.tsx",
    ],
    intent: "待还额为主，借出额和累计已还作为依据；支持部分还款。",
  },
];
