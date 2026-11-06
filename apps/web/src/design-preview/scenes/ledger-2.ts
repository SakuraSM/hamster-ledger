import type { SceneSpec } from "../model";
export const ledgerScenes2: SceneSpec[] = [
  {
    id: "advanced-entry",
    title: "更多交易类型",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "用同一张账页记录复杂交易",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "支出", selected: true },
          { label: "转账", target: "entry-transfer" },
          { label: "退款", target: "related-entry" },
          { label: "报销", target: "related-entry" },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "原币金额", value: "20.00" },
          { label: "币种", value: "USD", type: "select" },
          { label: "换算汇率", value: "7.10 · 手动填写" },
          { label: "折合人民币", value: "¥142.00" },
          { label: "付款账户", value: "工资卡", type: "select" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "AA 分摊",
            value: "未开启",
            icon: "users",
            target: "split-entry",
          },
          {
            label: "附件凭证",
            value: "添加",
            icon: "image",
            target: "attachment",
          },
        ],
      },
    ],
    actions: [{ label: "保存交易", target: "entry-saved" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "交易类型驱动字段展示，汇率与折算结果同时可见。",
  },
  {
    id: "split-entry",
    title: "一起花，分清楚",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "AA 分摊 · 示例聚餐",
    hero: "¥180.00",
    heroLabel: "本次总额",
    blocks: [
      {
        kind: "choices",
        items: [{ label: "平均分", selected: true }, { label: "自定义金额" }],
      },
      {
        kind: "list",
        items: [
          { label: "我", value: "¥60.00", note: "已付款", icon: "wallet" },
          { label: "小林", value: "¥60.00", note: "待结算", icon: "users" },
          { label: "小周", value: "¥60.00", note: "待结算", icon: "users" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "分摊合计 ¥180.00，与本次总额一致。",
      },
    ],
    actions: [{ label: "保存分摊", target: "entry-saved" }],
    sources: [
      "apps/web/src/components/finance/EntrySplitFields.tsx",
      "apps/mobile/src/screens/EntrySplitFields.tsx",
    ],
    intent: "金额校验紧贴成员列表，付款人和应承担金额分开表达。",
  },
  {
    id: "related-entry",
    title: "关联原消费",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "退款与报销回款都保留原账单关系",
    hero: "¥18.00",
    heroLabel: "本次退款",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "收款账户", value: "支付宝", type: "select" },
          { label: "关联原账单", value: "街角咖啡 · ¥18.00", type: "select" },
          { label: "退款时间", value: "2026-11-06 16:00", type: "select" },
        ],
      },
      {
        kind: "notice",
        heading: "计入方式",
        text: "退款抵扣原支出；转账与还款不计作收入。",
      },
    ],
    actions: [{ label: "保存关联交易", target: "entry-saved" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "原账单与回款并排可读，避免把回款误认为新增收入。",
  },
  {
    id: "filters",
    title: "只看关心的账单",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "筛选方案可在本机保存",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "待报销", selected: true },
          { label: "未关联账户" },
          { label: "我保存的方案" },
        ],
      },
      {
        kind: "fields",
        items: [
          {
            label: "日期范围",
            value: "2026-11-01 → 2026-11-30",
            type: "select",
          },
          { label: "收支类型", value: "全部", type: "select" },
          { label: "分类 / 账户", value: "全部", type: "select" },
          { label: "成员", value: "全部成员", type: "select" },
          { label: "报销状态", value: "待报销", type: "select" },
          { label: "方案名称", value: "本月待报销" },
        ],
      },
    ],
    actions: [
      { label: "应用筛选", target: "transactions" },
      { label: "保存方案", target: "transactions", secondary: true },
    ],
    sources: [
      "apps/web/src/components/finance/SavedFilters.tsx",
      "apps/mobile/src/screens/RecordFilters.tsx",
    ],
    intent: "复杂筛选聚合成一张可关闭的筛选账页，结果页只留摘要。",
  },
  {
    id: "batch",
    title: "一起整理",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "已选 2 笔 · 合计 ¥56.00",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "午餐", value: "−¥32.00", note: "已选择", icon: "check" },
          { label: "打车", value: "−¥24.00", note: "已选择", icon: "check" },
        ],
      },
      {
        kind: "fields",
        items: [{ label: "批量分类", value: "请选择分类", type: "select" }],
      },
      {
        kind: "notice",
        text: "删除会连同关联记录移入回收站，可通过撤销或回收站恢复。",
      },
    ],
    actions: [
      { label: "应用修改", target: "transactions" },
      { label: "移入回收站", target: "delete-confirm", secondary: true },
    ],
    sources: [
      "apps/web/src/components/finance/BatchActions.tsx",
      "apps/mobile/src/screens/BatchActions.tsx",
    ],
    intent: "选择态固定在列表上方，危险操作有独立确认。",
  },
  {
    id: "calendar",
    title: "11月",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "2026 · 按日期展开生活账页",
    blocks: [
      { kind: "calendar" },
      {
        kind: "list",
        heading: "11月6日 · 周五 · ¥56.00",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "12:10 · 餐饮",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "08:40 · 交通",
            icon: "car",
            target: "record",
          },
        ],
      },
    ],
    actions: [{ label: "为这天记一笔", target: "entry" }],
    sources: [
      "apps/web/src/components/planning/CalendarPage.tsx",
      "apps/mobile/src/screens/CalendarScreen.tsx",
    ],
    intent: "日期选择联动日账页，月历不与大表单争抢屏幕。",
  },
];
