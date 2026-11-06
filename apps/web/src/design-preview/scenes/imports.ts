import type { SceneSpec } from "../model";
export const importScenes: SceneSpec[] = [
  {
    id: "import",
    title: "账单放进来",
    group: "导入",
    nav: "inbox",
    subtitle: "导入到生活账 · 文件在本机解析",
    blocks: [
      {
        kind: "upload",
        heading: "选择 CSV / Excel",
        text: "UTF-8 / GB18030 · 单文件 10 MB 内",
        items: [{ label: "选择文件", icon: "upload" }],
      },
      {
        kind: "list",
        items: [
          {
            label: "生活账单-11月.csv",
            value: "8 笔",
            note: "已读取 · 字段待核对",
            icon: "receipt",
            target: "mapping",
          },
        ],
      },
      {
        kind: "notice",
        text: "先核对字段，再处理疑似重复。原始行与文件指纹会保留。",
        tone: "olive",
      },
    ],
    actions: [{ label: "核对字段", target: "mapping" }],
    sources: [
      "apps/web/src/components/ImportPage.tsx",
      "apps/mobile/src/screens/ImportScreen.tsx",
    ],
    intent: "分成添加、映射、核对三个清晰步骤，文件状态始终可见。",
  },
  {
    id: "mapping",
    title: "把字段对上",
    group: "导入",
    nav: "inbox",
    subtitle: "生活账单-11月.csv · 第1行是表头",
    blocks: [
      {
        kind: "mapping",
        items: [
          { label: "交易时间", value: "日期", note: "2026-11-06 12:10" },
          { label: "金额", value: "交易金额", note: "32.00" },
          { label: "交易名称", value: "商户", note: "午餐" },
          { label: "收支方向", value: "收支", note: "支出" },
          { label: "收付款账户", value: "暂不推断", note: "入账前由你确认" },
        ],
      },
      {
        kind: "notice",
        text: "已复用同表头模板。请再确认金额和时间，模板不自动确认付款账户。",
      },
    ],
    actions: [
      { label: "确认并保存映射模板", target: "import-errors" },
      { label: "重新识别表头", target: "mapping", secondary: true },
    ],
    sources: [
      "apps/web/src/components/FieldMapping.tsx",
      "apps/mobile/src/screens/StatementMapping.tsx",
    ],
    intent: "字段、原始列和样例并列展示，复用模板仍要求核对。",
  },
  {
    id: "import-errors",
    title: "还有一行要看看",
    group: "导入",
    nav: "inbox",
    subtitle: "7 行可识别 · 1 行无法识别",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        heading: "第4行：金额格式无效",
        text: "原始金额是“待补”，请修改文件或跳过此行。",
      },
      {
        kind: "list",
        items: [
          {
            label: "原始数据",
            note: "2026-11-03 · 交通 · 待补",
            icon: "receipt",
          },
          {
            label: "导出错误行与依据",
            note: "包含错误原因、原始行、文件指纹",
            icon: "download",
            target: "import-errors",
          },
        ],
      },
      {
        kind: "fields",
        items: [
          {
            label: "跳过错误行",
            value: "已确认仅导入有效记录",
            type: "toggle",
          },
        ],
      },
    ],
    actions: [
      { label: "导入7行有效记录", target: "import-done" },
      { label: "返回字段核对", target: "mapping", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ImportErrors.tsx",
      "apps/mobile/src/screens/ImportScreen.tsx",
    ],
    intent: "明确错误在哪一行，跳过必须由用户勾选。",
  },
  {
    id: "import-done",
    title: "账单已经放好了",
    group: "导入",
    nav: "inbox",
    layout: "state",
    subtitle: "生活账 · 本次处理7行",
    hero: "07",
    heroLabel: "文件解析完成",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "已入账", value: "5 笔" },
          { label: "待核对", value: "2 笔" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "生活账单-11月.csv",
            note: "文件与原始来源已保留",
            icon: "check",
          },
        ],
      },
      { kind: "notice", tone: "olive", text: "待核对记录暂不参与收支汇总。" },
    ],
    actions: [
      { label: "继续核对2笔", target: "duplicate" },
      { label: "查看全部账单", target: "transactions", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ImportNotices.tsx",
      "apps/mobile/src/screens/ImportScreen.tsx",
    ],
    intent: "处理结果区分已入账与待核对，直接引导下一步。",
  },
];
