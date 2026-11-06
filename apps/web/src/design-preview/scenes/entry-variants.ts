import type { SceneSpec } from "../model";
export const entryVariantScenes: SceneSpec[] = [
  {
    id: "entry-income",
    title: "一笔收入，清楚记下",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "收入 · 工资",
    hero: "¥8,500.00",
    heroLabel: "本次收入",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "交易名称", value: "工资" },
          { label: "分类", value: "工资", type: "select" },
          { label: "收款账户", value: "工资卡", type: "select" },
          { label: "交易时间", value: "2026-11-01 09:00", type: "select" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "收入与账户余额变化有关联，收款账户需由你确认。",
      },
    ],
    actions: [{ label: "保存收入", target: "entry-saved" }],
    sources: [
      "apps/web/src/components/SimpleEntryEditor.tsx",
      "apps/mobile/src/screens/SimpleEntryEditor.tsx",
    ],
    intent: "收入场景明确收款账户，不复用支出方向的含糊标签。",
  },
  {
    id: "entry-transfer",
    title: "钱换个位置",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "转账 · 不计入收入或支出",
    hero: "¥500.00",
    heroLabel: "转账金额",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "转出账户", value: "工资卡", type: "select" },
          { label: "转入账户", value: "现金", type: "select" },
          { label: "交易时间", value: "2026-11-06 17:00", type: "select" },
          { label: "备注", value: "取现用于日常开支" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "转出与转入账户必须不同。转账改变两个账户的余额，不改变净收支。",
      },
    ],
    actions: [{ label: "确认保存转账", target: "entry-saved" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "把双账户关系作为中心，明确不计收支。",
  },
  {
    id: "reimburse-entry",
    title: "回款，关联到原消费",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "报销示例 · 部分回款",
    hero: "¥80.00",
    heroLabel: "本次回款",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "关联原消费", value: "办公用品 · ¥200.00", type: "select" },
          { label: "收款账户", value: "工资卡", type: "select" },
          { label: "回款时间", value: "2026-11-06", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "保存后累计回款80元，仍待回款120元。报销回款按关联交易口径统计。",
        tone: "olive",
      },
    ],
    actions: [{ label: "保存报销回款", target: "extended-reports" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "原金额、已回款与待回款在同一张账页可核对。",
  },
  {
    id: "loan-edit",
    title: "借给谁，什么时候还",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "新增借贷示例",
    blocks: [
      {
        kind: "choices",
        items: [{ label: "借出", selected: true }, { label: "借入" }],
      },
      {
        kind: "fields",
        items: [
          { label: "对方姓名", value: "小林" },
          { label: "借贷金额", value: "600.00" },
          { label: "关联账户", value: "工资卡", type: "select" },
          { label: "发生日期", value: "2026-11-01", type: "select" },
          { label: "到期日期", value: "2026-11-30", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "借贷与后续还款保留关联关系，避免把归还本金计作普通收入。",
      },
    ],
    actions: [{ label: "保存借贷", target: "debts" }],
    sources: [
      "apps/web/src/components/finance/FinanceFormDialog.tsx",
      "apps/mobile/src/screens/FinanceFormSheet.tsx",
    ],
    intent: "方向、对方、金额与日期是借贷表单的核心。",
  },
  {
    id: "goal-edit",
    title: "想存下的那件事",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "储蓄目标设置",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "目标名称", value: "周末去海边" },
          { label: "目标金额", value: "6,000.00" },
          { label: "目标日期", value: "2027-03-01", type: "select" },
          { label: "关联账户", value: "工资卡", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "目标进度单独记录，不把计划金额当作已经发生的收支。",
      },
    ],
    actions: [{ label: "保存储蓄目标", target: "goals" }],
    sources: [
      "apps/web/src/components/finance/FinanceFormDialog.tsx",
      "apps/mobile/src/screens/FinanceFormSheet.tsx",
    ],
    intent: "目标和真实资金变动分开表达，避免展示假资产。",
  },
  {
    id: "goal-contribute",
    title: "离目标，再近一点",
    group: "计划与提醒",
    nav: "mine",
    subtitle: "周末去海边 · 当前已存 ¥2,400.00",
    hero: "¥100.00",
    heroLabel: "本次存入进度",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "存入金额", value: "100.00" },
          { label: "记录日期", value: "2026-11-06", type: "select" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "保存后目标进度为 ¥2,500.00 / ¥6,000.00，距离目标还差 ¥3,500.00。",
      },
    ],
    actions: [{ label: "保存目标进度", target: "goals" }],
    sources: [
      "apps/web/src/components/finance/GoalsList.tsx",
      "apps/mobile/src/screens/GoalsList.tsx",
    ],
    intent: "目标更新前后金额可读，明确这是一笔进度记录。",
  },
];
