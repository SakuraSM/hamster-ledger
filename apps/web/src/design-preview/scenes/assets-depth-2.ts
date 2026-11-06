import type { SceneSpec } from "../model";
export const assetDepthScenes2: SceneSpec[] = [
  {
    id: "account-records",
    title: "账户里的原始账单",
    group: "资产与报表",
    nav: "mine",
    subtitle: "现金 · 原始账单视角",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "原始账单", selected: true },
          { label: "余额变化", target: "account-detail" },
          { label: "月份", target: "asset-date" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "11月6日 · 已确认 · 已计入当前余额",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "11月6日 · 已确认 · 已计入当前余额",
            icon: "car",
            target: "record",
          },
          {
            label: "待核对的交通记录",
            value: "¥24.00",
            note: "待确认 · 尚未计入余额",
            icon: "warning",
            target: "unpaired",
          },
          {
            label: "基准之前的记录",
            value: "¥10.00",
            note: "10月31日 · 不再次叠加到当前基准",
            icon: "receipt",
            target: "record",
          },
        ],
      },
      {
        kind: "notice",
        text: "原始账单可以包含未计入项；余额变化页只展示实际影响余额的事件。",
      },
    ],
    actions: [{ label: "返回余额变化", target: "account-detail" }],
    sources: [
      "apps/web/src/components/assets/AccountHistory.tsx",
      "apps/mobile/src/screens/AccountRecordList.tsx",
    ],
    intent: "解释“有流水却没有影响余额”的边界，避免错误地再次累加。",
  },
  {
    id: "asset-unassigned",
    title: "给历史流水找个账户",
    group: "资产与报表",
    nav: "mine",
    subtitle: "2 笔尚未关联 · 不自动猜测出资账户",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "历史交通记录",
            value: "¥24.00",
            note: "来源：支付平台 · 账户未关联",
            icon: "car",
            target: "metadata",
          },
          {
            label: "历史采购",
            value: "¥120.00",
            note: "来源：导入文件 · 账户未关联",
            icon: "bag",
            target: "metadata",
          },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        text: "支付平台不代表实际银行卡。请核对后选择真实账户；不能凭平台名称自动填入。",
      },
    ],
    actions: [
      { label: "核对第一笔账户", target: "metadata" },
      { label: "先建立缺少的账户", target: "account-edit", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AssetsPage.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent: "把未关联状态转化为可执行的核对清单。",
  },
  {
    id: "asset-date",
    title: "想看哪一天的资产",
    group: "资产与报表",
    nav: "mine",
    subtitle: "账户状态、基准与估值日期保持一致",
    blocks: [
      {
        kind: "fields",
        items: [{ label: "估值日期", value: "2026-11-06", type: "select" }],
      },
      {
        kind: "choices",
        items: [
          { label: "今天", selected: true },
          { label: "上月末" },
          { label: "自定义日期" },
        ],
      },
      {
        kind: "notice",
        text: "该日期之前没有余额基准或缺少参考汇率的账户会明确标注，不能当作0元。",
      },
    ],
    actions: [{ label: "查看该日资产", target: "assets" }],
    sources: [
      "apps/web/src/components/assets/AssetsPage.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent: "日期是估值条件而非装饰性的筛选。",
  },
  {
    id: "missing-baseline",
    title: "这部分，还不能算完整",
    group: "资产与报表",
    nav: "mine",
    subtitle: "历史账户尚未建立可用余额基准",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        heading: "未计入合计：备用账户",
        text: "所选日期之前没有明确余额基准，因此不以0元代替，也不绘制假历史曲线。",
      },
      {
        kind: "list",
        items: [
          {
            label: "备用账户",
            value: "缺少基准",
            note: "请核对实际余额与确认时间",
            icon: "warning",
            target: "account-edit",
          },
          {
            label: "当前已知部分",
            value: "查看",
            note: "包含完整基准的账户继续展示",
            icon: "wallet",
            target: "assets",
          },
        ],
      },
    ],
    actions: [
      { label: "补充余额基准", target: "account-edit" },
      { label: "换一个估值日期", target: "asset-date", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AssetTotals.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent: "未知与0元不能混淆，不完整资产不伪装成完整统计。",
  },
  {
    id: "foreign-account",
    title: "外币账户也有依据",
    group: "资产与报表",
    nav: "mine",
    subtitle: "外币独立示例 · 美元账户",
    hero: "US$200.00",
    heroLabel: "原币余额",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "手动参考汇率", value: "7.10" },
          { label: "折合人民币", value: "¥1,420.00" },
        ],
      },
      {
        kind: "list",
        items: [
          { label: "估值日期", value: "2026-11-06", icon: "calendar" },
          {
            label: "汇率来源",
            value: "手动示例值",
            icon: "globe",
            target: "rates",
          },
          {
            label: "原币基准与变化",
            value: "查看",
            icon: "wallet",
            target: "account-history",
          },
        ],
      },
      {
        kind: "notice",
        text: "原币余额与人民币估值分开保存。示例参考值不代表市场报价。",
      },
    ],
    actions: [{ label: "管理参考汇率", target: "rates" }],
    sources: [
      "apps/web/src/components/assets/ValuationRates.tsx",
      "apps/mobile/src/screens/ValuationRates.tsx",
    ],
    intent: "显示币种、估值日期与来源，避免把换算值当作原币余额。",
  },
];
