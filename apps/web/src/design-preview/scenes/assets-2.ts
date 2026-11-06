import type { SceneSpec } from "../model";
export const assetScenes2: SceneSpec[] = [
  {
    id: "rates",
    title: "外币参考汇率",
    group: "资产与报表",
    nav: "mine",
    subtitle: "估值日期 · 2026-11-06",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "USD → CNY",
            value: "7.10",
            note: "手动参考值 · 示例",
            icon: "globe",
          },
          {
            label: "EUR → CNY",
            value: "待补充",
            note: "缺少汇率，暂不折算",
            icon: "warning",
            tone: "red",
          },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "补充币种", value: "EUR", type: "select" },
          { label: "对人民币汇率", value: "" },
          { label: "生效日期", value: "2026-11-06", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "缺失项会明确标出，绝不按 1:1 估算。示例汇率不代表市场报价。",
      },
    ],
    actions: [{ label: "保存参考值", target: "assets" }],
    sources: [
      "apps/web/src/components/assets/ValuationRates.tsx",
      "apps/mobile/src/screens/ValuationRates.tsx",
    ],
    intent: "缺失、来源和估值日期与数值同层展示。",
  },
  {
    id: "reports",
    title: "花在了哪里",
    group: "资产与报表",
    nav: "ledger",
    subtitle: "2026年11月 · 仅已确认收支",
    hero: "¥1,286.40",
    heroLabel: "本期净支出",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "按分类", selected: true },
          { label: "按标签" },
          { label: "日期范围", target: "report-range" },
        ],
      },
      {
        kind: "chart",
        heading: "支出组成",
        items: [
          { label: "购物", value: "826.40" },
          { label: "餐饮", value: "252" },
          { label: "交通", value: "108" },
          { label: "订阅", value: "100" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "成员与报销",
            value: "展开",
            icon: "users",
            target: "extended-reports",
          },
          {
            label: "净资产趋势",
            value: "查看",
            icon: "chart",
            target: "net-worth",
          },
        ],
      },
    ],
    actions: [{ label: "查看对应账单", target: "transactions" }],
    sources: [
      "apps/web/src/components/planning/ReportsPage.tsx",
      "apps/mobile/src/screens/ReportsScreen.tsx",
    ],
    intent: "图表与可钻取金额列表放在同一阅读路径。",
  },
  {
    id: "report-range",
    title: "选一段时间",
    group: "资产与报表",
    nav: "ledger",
    subtitle: "所有报表沿用相同账期口径",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "本月", selected: true },
          { label: "今年" },
          { label: "自定义" },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "开始日期", value: "2026-11-01", type: "select" },
          { label: "结束日期", value: "2026-12-01", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "本次范围包含11月1日，不包含12月1日。转账与还款不计收支。",
        tone: "olive",
      },
    ],
    actions: [{ label: "应用日期范围", target: "reports" }],
    sources: [
      "apps/web/src/components/planning/ExtendedReports.tsx",
      "apps/mobile/src/screens/ExtendedReports.tsx",
    ],
    intent: "明确边界是否包含，避免不同报表给出不同时间口径。",
  },
  {
    id: "net-worth",
    title: "资产慢慢积累",
    group: "资产与报表",
    nav: "mine",
    subtitle: "11月1日 → 11月6日 · 示例",
    hero: "¥28,420.00",
    heroLabel: "期末净资产",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "期初", value: "¥21,206.40" },
          { label: "本期变化", value: "+¥7,213.60" },
        ],
      },
      {
        kind: "chart",
        heading: "净资产变化",
        items: [
          { label: "期初", value: "21206.4" },
          { label: "01", value: "29606.4" },
          { label: "03", value: "29302.4" },
          { label: "05", value: "28476" },
          { label: "06", value: "28420" },
        ],
      },
      {
        kind: "notice",
        text: "按当时账户状态和余额基准计算。缺少历史基准或汇率时显示待补充。",
      },
    ],
    actions: [{ label: "查看账户明细", target: "assets" }],
    sources: [
      "apps/web/src/components/assets/AssetTrend.tsx",
      "apps/mobile/src/screens/NetWorthReport.tsx",
    ],
    intent: "期初期末、变化与曲线共用数据，归档历史不消失。",
  },
  {
    id: "extended-reports",
    title: "回款与分摊",
    group: "资产与报表",
    nav: "ledger",
    subtitle: "按成员、报销和关联交易查看",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "报销", selected: true },
          { label: "成员分摊" },
          { label: "标签" },
        ],
      },
      {
        kind: "metrics",
        items: [
          { label: "待报销", value: "¥120.00" },
          { label: "已回款", value: "¥80.00" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "办公用品",
            value: "¥200.00",
            note: "部分回款 · 80 / 200",
            icon: "bag",
            target: "record",
          },
          {
            label: "查看回款关联",
            value: "1 笔",
            icon: "receipt",
            target: "related-entry",
          },
        ],
      },
    ],
    actions: [{ label: "查看待报销账单", target: "filters" }],
    sources: [
      "apps/web/src/components/planning/ExtendedReports.tsx",
      "apps/mobile/src/screens/ExtendedReports.tsx",
    ],
    intent:
      "关联回款与原消费一起呈现；这是独立报销示例账本，避免与生活账总额混用。",
  },
];
