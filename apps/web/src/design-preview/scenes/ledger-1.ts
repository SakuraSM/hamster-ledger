import type { SceneSpec } from "../model";
export const ledgerScenes1: SceneSpec[] = [
  {
    id: "overview",
    title: "这个月，花得清楚",
    group: "账单与统计",
    nav: "ledger",
    layout: "overview",
    subtitle: "2026年11月 · 示例账本",
    hero: "¥1,286.40",
    heroLabel: "本月支出",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "收入", value: "¥8,500.00" },
          { label: "结余", value: "¥7,213.60" },
        ],
      },
      {
        kind: "progress",
        heading: "本月预算",
        value: "26",
        caption: "还可支出 ¥3,713.60 / ¥5,000.00",
      },
      {
        kind: "chart",
        heading: "近六天支出",
        items: [
          { label: "01", value: "100" },
          { label: "02", value: "220" },
          { label: "03", value: "84" },
          { label: "04", value: "310" },
          { label: "05", value: "516.4" },
          { label: "06", value: "56" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "3 笔待处理",
            note: "AI 草稿与导入核对",
            icon: "receipt",
            target: "inbox",
          },
        ],
      },
    ],
    actions: [{ label: "记一笔", target: "entry" }],
    sources: [
      "apps/web/src/components/Overview.tsx",
      "apps/mobile/src/screens/OverviewScreen.tsx",
    ],
    intent: "月度金额为主，预算与趋势为辅，队列入口随手可达。",
  },
  {
    id: "transactions",
    title: "每一笔，都有来处",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "11月 · 已确认账单",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "全部", selected: true },
          { label: "待报销" },
          { label: "未关联账户" },
          { label: "筛选", target: "filters" },
          { label: "导出", target: "ledger-export" },
        ],
      },
      {
        kind: "metrics",
        items: [
          { label: "净支出", value: "¥1,286.40" },
          { label: "收入", value: "¥8,500.00" },
        ],
      },
      {
        kind: "list",
        heading: "今天 · 11月6日",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "12:10 · 餐饮 · 现金",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "08:40 · 交通 · 现金",
            icon: "car",
            target: "record",
          },
        ],
      },
      {
        kind: "list",
        heading: "11月5日",
        items: [
          {
            label: "生活用品",
            value: "−¥516.40",
            note: "购物 · 支付宝",
            icon: "bag",
            target: "record",
          },
        ],
      },
    ],
    actions: [
      { label: "记一笔", target: "entry" },
      { label: "批量整理", target: "batch", secondary: true },
    ],
    sources: [
      "apps/web/src/components/Transactions.tsx",
      "apps/mobile/src/screens/TransactionsScreen.tsx",
    ],
    intent: "按日期排成连续账页，筛选可收起，避免把表单和列表挤在一起。",
  },
  {
    id: "record",
    title: "账单详情",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "已入账 · 手动记账",
    hero: "−¥32.00",
    heroLabel: "午餐",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "交易时间", value: "11月6日 12:10", icon: "calendar" },
          { label: "分类", value: "餐饮", icon: "food" },
          { label: "收付款账户", value: "现金", icon: "wallet" },
          {
            label: "标签与备注",
            value: "日常",
            note: "工作日午餐",
            icon: "tag",
          },
          {
            label: "原始信息与凭证",
            value: "查看",
            icon: "receipt",
            target: "record-source",
          },
        ],
      },
      {
        kind: "notice",
        heading: "原始来源保留",
        text: "修改信息或移入回收站都不会覆盖原始凭证。",
        tone: "olive",
      },
    ],
    actions: [
      { label: "编辑账单", target: "entry" },
      { label: "移入回收站", target: "delete-confirm", secondary: true },
    ],
    sources: [
      "apps/web/src/components/RecordDetail.tsx",
      "apps/mobile/src/screens/RecordDetail.tsx",
    ],
    intent: "金额、凭证、账户和原始来源按阅读顺序组织。",
  },
  {
    id: "entry",
    title: "记下这一笔",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "今天 · 连续记账已开启",
    hero: "¥32.00",
    heroLabel: "支出",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "支出", selected: true },
          { label: "收入", target: "entry-income" },
          { label: "更多类型", target: "advanced-entry" },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "商户 / 交易名称", value: "午餐" },
          { label: "分类", value: "餐饮", type: "select" },
          { label: "账户", value: "现金", type: "select" },
          { label: "交易时间", value: "2026-11-06 12:10", type: "select" },
        ],
      },
      {
        kind: "choices",
        heading: "常用快捷填入",
        items: [
          { label: "午餐", selected: true },
          { label: "通勤" },
          { label: "生活采购" },
        ],
      },
    ],
    actions: [
      { label: "保存并继续", target: "entry-saved" },
      {
        label: "多币种 / AA / 退款",
        target: "advanced-entry",
        secondary: true,
      },
    ],
    sources: [
      "apps/web/src/components/SimpleEntryEditor.tsx",
      "apps/mobile/src/screens/SimpleEntryEditor.tsx",
    ],
    intent: "先金额再分类账户，复杂字段从简洁主表单中展开。",
  },
];
