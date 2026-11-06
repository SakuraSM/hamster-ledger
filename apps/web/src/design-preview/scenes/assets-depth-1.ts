import type { SceneSpec } from "../model";
export const assetDepthScenes1: SceneSpec[] = [
  {
    id: "bank-detail",
    title: "工资卡",
    group: "资产与报表",
    nav: "mine",
    layout: "account",
    subtitle: "银行卡 · 余额由基准与已确认流水计算",
    blocks: [],
    actions: [
      { label: "账户间转账", target: "entry-transfer" },
      { label: "核对实际余额", target: "calibration", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetAccountDetail.tsx",
    ],
    intent: "账户余额、基准、变动和原始账单可逐层追溯。",
  },
  {
    id: "liability-detail",
    title: "信用卡",
    group: "资产与报表",
    nav: "mine",
    layout: "account",
    subtitle: "负债与还款安排",
    blocks: [],
    actions: [
      { label: "记录信用卡还款", target: "card-repayment" },
      { label: "编辑信用卡", target: "liability-edit", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetAccountDetail.tsx",
    ],
    intent: "突出剩余负债、信用额度与还款日期；还款不计支出。",
  },
  {
    id: "liability-edit",
    title: "把这张信用卡记清楚",
    group: "资产与报表",
    nav: "mine",
    subtitle: "负债账户 · 信用卡",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "账户名称", value: "信用卡" },
          { label: "基准负债", value: "2,500.00" },
          { label: "币种", value: "CNY", type: "select" },
          { label: "信用额度", value: "20,000.00" },
          { label: "账单日 / 还款日", value: "8日 / 18日", type: "select" },
          { label: "负债确认时间", value: "2026-10-31 23:59", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "额度和还款日用于管理提醒。此处余额由你维护，不代表银行实时账单。",
      },
    ],
    actions: [{ label: "保存负债账户", target: "liability-detail" }],
    sources: [
      "apps/web/src/components/assets/AccountEditor.tsx",
      "apps/mobile/src/screens/AccountEditor.tsx",
    ],
    intent: "负债不是负数资产；用清晰的账户性质和账单日期表达。",
  },
  {
    id: "card-repayment",
    title: "记下一次信用卡还款",
    group: "资产与报表",
    nav: "mine",
    subtitle: "当前剩余负债 ¥2,500.00",
    hero: "¥500.00",
    heroLabel: "本次还款",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "付款资产账户", value: "工资卡", type: "select" },
          { label: "还款负债账户", value: "信用卡", type: "select" },
          { label: "还款时间", value: "2026-11-06 17:00", type: "select" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "保存后：工资卡 ¥25,500.00，信用卡负债 ¥2,000.00。净资产仍为 ¥28,420.00，还款不计支出。",
      },
    ],
    actions: [{ label: "确认记录还款", target: "card-repayment-done" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "同时展示两端余额变化和净资产不变，避免把还款重复当支出。",
  },
  {
    id: "card-repayment-done",
    title: "还款已经记好",
    group: "资产与报表",
    nav: "mine",
    layout: "state",
    subtitle: "信用卡还款 ¥500.00",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "工资卡余额", value: "¥25,500.00" },
          { label: "信用卡剩余负债", value: "¥2,000.00" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "净资产未变，仍为 ¥28,420.00。本期收入与支出不因此增加。",
      },
    ],
    actions: [{ label: "返回资产总览", target: "assets" }],
    sources: [
      "apps/web/src/components/finance/AdvancedEntryEditor.tsx",
      "apps/mobile/src/screens/AdvancedEntryEditor.tsx",
    ],
    intent: "结果页证明还款对账户与总额的不同影响。",
  },
  {
    id: "calibration-difference",
    title: "差的20元，先说明白",
    group: "资产与报表",
    nav: "mine",
    subtitle: "现金 · 新余额基准预览",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "当前计算余额", value: "¥3,200.00" },
          { label: "核对实际余额", value: "¥3,180.00" },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        heading: "将校准差额 −¥20.00",
        text: "保存新基准不会伪造一笔支出，旧基准与原始流水仍保留。",
      },
      {
        kind: "fields",
        items: [
          { label: "生效时间", value: "2026-11-06 17:30", type: "select" },
          { label: "校准原因", value: "现金盘点，核对实际差额" },
        ],
      },
    ],
    actions: [
      { label: "确认保存新基准", target: "calibration-done" },
      { label: "先查找遗漏的账单", target: "account-records", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/BalanceCalibration.tsx",
      "apps/mobile/src/screens/BalanceCalibration.tsx",
    ],
    intent: "差额、原因和生效时间明确后才提交；提供先查流水的路径。",
  },
  {
    id: "calibration-done",
    title: "新基准已经保留",
    group: "资产与报表",
    nav: "mine",
    layout: "state",
    subtitle: "现金 · 2026-11-06 17:30",
    hero: "¥3,180.00",
    heroLabel: "新的实际余额基准",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "原余额基准仍可查看。新时间之后的已确认流水会基于3,180元累计。",
      },
      {
        kind: "metrics",
        items: [
          { label: "本次基准差额", value: "−¥20.00" },
          { label: "新增支出账单", value: "0 笔" },
        ],
      },
    ],
    actions: [{ label: "查看基准历史", target: "account-history" }],
    sources: [
      "apps/web/src/components/assets/BalanceCalibration.tsx",
      "apps/mobile/src/screens/BalanceCalibration.tsx",
    ],
    intent: "明确校准是基准变化而不是凭空记一笔收支。",
  },
];
