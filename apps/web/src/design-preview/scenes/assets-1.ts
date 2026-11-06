import type { SceneSpec } from "../model";
export const assetScenes1: SceneSpec[] = [
  {
    id: "assets",
    layout: "assets",
    title: "钱在哪里，一眼清楚",
    group: "资产与报表",
    nav: "mine",
    subtitle: "截至 2026年11月6日 · 人民币",
    hero: "¥28,420.00",
    heroLabel: "当前净资产",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "总资产", value: "¥30,920.00" },
          { label: "总负债", value: "¥2,500.00" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "工资卡",
            value: "¥26,000.00",
            note: "银行卡 · CNY",
            icon: "wallet",
            target: "account-detail",
          },
          {
            label: "现金",
            value: "¥3,200.00",
            note: "上次基准 10月31日",
            icon: "wallet",
            target: "account-detail",
          },
          {
            label: "支付宝 / 微信",
            value: "¥1,720.00",
            note: "2 个账户",
            icon: "wallet",
            target: "account-detail",
          },
          {
            label: "信用卡",
            value: "¥2,500.00",
            note: "负债 · 11月18日还款",
            icon: "wallet",
            target: "account-detail",
          },
        ],
      },
    ],
    actions: [
      { label: "账户间转账", target: "entry-transfer" },
      { label: "查看净资产趋势", target: "net-worth", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AssetsPage.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent: "先净资产，再账户；负债用明确标签而非正负颜色暗示。",
  },
  {
    id: "account-detail",
    layout: "account",
    title: "现金",
    group: "资产与报表",
    nav: "mine",
    subtitle: "资产账户 · CNY",
    hero: "¥3,200.00",
    heroLabel: "按已确认账单计算",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "余额基准", value: "¥3,256.00" },
          { label: "基准后变化", value: "−¥56.00" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "11月6日 12:10",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "11月6日 08:40",
            icon: "car",
            target: "record",
          },
          {
            label: "余额与归档历史",
            value: "查看",
            icon: "clock",
            target: "account-history",
          },
        ],
      },
    ],
    actions: [
      { label: "核对实际余额", target: "calibration" },
      { label: "编辑账户", target: "account-edit", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetAccountDetail.tsx",
    ],
    intent: "把当前余额拆解为基准和流水变化，给异常余额一条排查路径。",
  },
  {
    id: "account-edit",
    title: "建立一个余额基准",
    group: "资产与报表",
    nav: "mine",
    subtitle: "账户名称与币种会影响后续关联",
    blocks: [
      {
        kind: "choices",
        items: [{ label: "资产", selected: true }, { label: "负债" }],
      },
      {
        kind: "fields",
        items: [
          { label: "账户名称", value: "现金" },
          { label: "账户类型", value: "现金", type: "select" },
          { label: "币种", value: "CNY", type: "select" },
          { label: "实际余额", value: "3,256.00" },
          { label: "确认时间", value: "2026-10-31 23:59", type: "select" },
          { label: "别名", value: "日常现金" },
        ],
      },
    ],
    actions: [
      { label: "保存账户", target: "assets" },
      { label: "查看全部账户类型", target: "account-types", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountEditor.tsx",
      "apps/mobile/src/screens/AccountEditor.tsx",
    ],
    intent: "明确基准时间，避免把历史流水重复叠加到账户余额。",
  },
  {
    id: "calibration",
    title: "让余额对得上",
    group: "资产与报表",
    nav: "mine",
    subtitle: "现金 · 保留以前的余额基准",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "当前计算余额", value: "¥3,200.00" },
          { label: "实际余额", value: "¥3,200.00" },
        ],
      },
      {
        kind: "fields",
        items: [
          { label: "本次确认余额", value: "3,200.00" },
          { label: "确认时间", value: "2026-11-06 17:00", type: "select" },
          { label: "校准备注", value: "与实际现金核对一致" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        heading: "历史仍然保留",
        text: "新基准只影响该时间之后的计算，不覆盖旧基准。",
      },
    ],
    actions: [{ label: "预览本次基准变化", target: "calibration-difference" }],
    sources: [
      "apps/web/src/components/assets/BalanceCalibration.tsx",
      "apps/mobile/src/screens/BalanceCalibration.tsx",
    ],
    intent: "同时展示计算值、实际值和校准结果，说明生效时间。",
  },
  {
    id: "account-history",
    title: "余额的来龙去脉",
    group: "资产与报表",
    nav: "mine",
    subtitle: "现金 · 历史基准与状态",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "余额已核对",
            value: "¥3,200.00",
            note: "11月6日 17:00 · 与实际现金一致",
            icon: "check",
          },
          {
            label: "午餐",
            value: "−¥32.00",
            note: "11月6日 12:10 · 已确认",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "11月6日 08:40 · 已确认",
            icon: "car",
          },
          {
            label: "创建余额基准",
            value: "¥3,256.00",
            note: "10月31日 23:59 · 初始余额",
            icon: "wallet",
          },
        ],
      },
      {
        kind: "notice",
        text: "归档从确认的时间起生效，以前的净资产曲线继续保留。",
      },
    ],
    actions: [
      { label: "返回账户", target: "account-detail" },
      { label: "归档账户", target: "archive-confirm", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountHistory.tsx",
      "apps/mobile/src/screens/AssetAccountDetail.tsx",
    ],
    intent: "状态变化与基准变化排成时间线，可追溯而非覆盖。",
  },
];
