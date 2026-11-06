import type { SceneSpec } from "../model";
export const completenessScenes1: SceneSpec[] = [
  {
    id: "credit-prepaid",
    title: "这部分，是预存余额",
    group: "资产与报表",
    nav: "mine",
    subtitle: "独立信用卡示例 · 基准为负值",
    hero: "¥500.00",
    heroLabel: "预存余额",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "剩余负债", value: "¥0.00" },
          { label: "账户基准", value: "−¥500.00" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "负债账户余额为负时按预存表达，不能仍标成剩余负债500元。实际余额需由你核对。",
      },
      {
        kind: "list",
        items: [
          {
            label: "基准与历史",
            value: "查看",
            icon: "clock",
            target: "account-history",
          },
        ],
      },
    ],
    actions: [{ label: "核对这个账户余额", target: "calibration" }],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetAccountDetail.tsx",
    ],
    intent: "用正负值的实际含义命名金额，避免让预存与负债混淆。",
  },
  {
    id: "asset-archived",
    title: "归档后，历史仍在",
    group: "资产与报表",
    nav: "mine",
    subtitle: "现金 · 归档自11月6日17:30生效",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "当前净资产", value: "¥25,220.00" },
          { label: "归档前净资产", value: "¥28,420.00" },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        heading: "当前范围少了现金账户",
        text: "现金3,200元不再计入当前合计；这不代表生成了消费或转移了资金。",
      },
      {
        kind: "list",
        items: [
          {
            label: "11月5日历史净资产",
            value: "¥28,476.00",
            note: "当时账户尚未归档，历史仍计入",
            icon: "chart",
            target: "net-worth",
          },
          {
            label: "恢复账户",
            value: "保留历史ID",
            icon: "refresh",
            target: "account-detail",
          },
        ],
      },
    ],
    actions: [
      { label: "查看归档历史", target: "account-history" },
      { label: "恢复账户", target: "account-detail", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent:
      "解释归档对当前范围和历史范围的不同影响，不把净资产范围变化伪装成花费。",
  },
  {
    id: "account-types",
    title: "选择适合的账户类型",
    group: "资产与报表",
    nav: "mine",
    subtitle: "资产与负债分开管理",
    blocks: [
      {
        kind: "choices",
        heading: "资产账户",
        items: [
          { label: "银行卡", target: "account-edit" },
          { label: "现金", selected: true, target: "account-edit" },
          { label: "网络钱包", target: "wallet-accounts" },
          { label: "投资", target: "investment-account" },
          { label: "应收款", target: "account-edit" },
          { label: "储值卡", target: "account-edit" },
          { label: "固定资产", target: "account-edit" },
          { label: "其他资产", target: "account-edit" },
        ],
      },
      {
        kind: "choices",
        heading: "负债账户",
        items: [
          { label: "信用卡", target: "liability-edit" },
          { label: "贷款", target: "liability-edit" },
          { label: "应付款", target: "liability-edit" },
          { label: "其他负债", target: "liability-edit" },
        ],
      },
      {
        kind: "notice",
        text: "已有账户的性质与币种保持稳定，历史账单继续通过原账户ID关联。",
      },
    ],
    actions: [{ label: "继续建立账户基准", target: "account-edit" }],
    sources: [
      "apps/web/src/components/assets/AccountEditor.tsx",
      "apps/mobile/src/screens/AccountEditor.tsx",
    ],
    intent: "完整呈现已有账户类型，不把资产管理缩减为银行卡余额列表。",
  },
  {
    id: "record-source",
    title: "原始信息，留在这里",
    group: "账单与统计",
    nav: "ledger",
    subtitle: "午餐 · 已确认 · 手动记账",
    hero: "¥32.00",
    heroLabel: "原始金额",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "原交易时间", value: "11月6日12:10", icon: "calendar" },
          { label: "原始收支", value: "支出 · CNY", icon: "receipt" },
          {
            label: "账户关联",
            value: "现金",
            note: "由用户确认，不按平台自动推断",
            icon: "wallet",
          },
          {
            label: "来源记录",
            value: "DEMO-001",
            note: "虚构编号，仅作设计示例",
            icon: "shield",
          },
        ],
      },
      {
        kind: "notice",
        text: "分类编辑不覆盖来源信息。关联重复时保留各来源的原始记录。",
      },
    ],
    actions: [{ label: "返回账单详情", target: "record" }],
    sources: [
      "apps/web/src/components/finance/TransactionFacts.tsx",
      "apps/mobile/src/screens/TransactionFacts.tsx",
    ],
    intent: "把统计字段与原始凭据分开，使修改可追溯。",
  },
  {
    id: "ledger-export",
    title: "把当前结果带走",
    group: "数据与设置",
    nav: "ledger",
    subtitle: "当前筛选 · 8笔已确认账单",
    blocks: [
      {
        kind: "choices",
        heading: "导出格式",
        items: [{ label: "CSV", selected: true }, { label: "Excel" }],
      },
      {
        kind: "metrics",
        items: [
          { label: "本期收入", value: "¥8,500.00" },
          { label: "本期净支出", value: "¥1,286.40" },
        ],
      },
      {
        kind: "notice",
        text: "表格导出适合查看与分享。完整恢复请使用包含附件的归档备份。",
      },
    ],
    actions: [
      { label: "导出当前筛选", target: "transactions" },
      { label: "改为完整备份", target: "backup", secondary: true },
    ],
    sources: [
      "apps/web/src/components/Transactions.tsx",
      "apps/mobile/src/platform/files.ts",
    ],
    intent: "明确筛选范围、格式和恢复能力，避免把报表当完整备份。",
  },
];
