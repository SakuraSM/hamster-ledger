import type { SceneSpec } from "../model";
export const completenessScenes2: SceneSpec[] = [
  {
    id: "attachment-manage",
    title: "这笔账的凭证",
    group: "记录与核对",
    nav: "ledger",
    subtitle: "街角咖啡草稿 · 1张示例凭证",
    blocks: [
      { kind: "image", caption: "原始图片可放大核对" },
      {
        kind: "list",
        items: [
          {
            label: "添加图片",
            note: "选择本机凭证文件",
            icon: "upload",
            target: "attachment",
          },
          {
            label: "移除关联",
            note: "从本草稿移除，后续由清理规则处理未使用附件",
            icon: "trash",
            target: "ai-drafts",
          },
        ],
      },
    ],
    actions: [{ label: "返回核对", target: "inbox" }],
    sources: [
      "apps/web/src/components/ai/RecordAttachments.tsx",
      "apps/mobile/src/screens/RecordAttachments.tsx",
    ],
    intent: "添加、查看和移除关联都保留明确入口，清理与删除账单分开。",
  },
  {
    id: "ai-policy",
    title: "何时可以自动入账",
    group: "记录与核对",
    nav: "mine",
    subtitle: "仅适用已授权的联网账本",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "对此联网账本开启AI自动入账", value: "关", type: "toggle" },
        ],
      },
      {
        kind: "notice",
        heading: "默认仍先核对",
        text: "仅字段完整、账户明确且无重复疑点的普通收支可自动保存。其他结果继续进入待确认草稿。",
        tone: "olive",
      },
      {
        kind: "list",
        items: [
          { label: "配置权限", value: "所有者 / 管理员", icon: "shield" },
          {
            label: "模型视觉能力",
            value: "单独配置",
            icon: "image",
            target: "model",
          },
        ],
      },
    ],
    actions: [{ label: "保存此账本策略", target: "ai-input" }],
    sources: [
      "apps/web/src/components/ai/AiPanel.tsx",
      "apps/mobile/src/screens/AiScreen.tsx",
    ],
    intent: "自动化能力与边界同时可读，不把不确定结果直接入账。",
  },
  {
    id: "payment-discard",
    title: "忽略这条候选消息？",
    group: "支付通知 · Android",
    nav: "inbox",
    mobileOnly: true,
    layout: "state",
    subtitle: "微信支付 · 合成消息",
    blocks: [
      {
        kind: "notice",
        text: "忽略不会新增账单，也不会删除已经存在的关联账单。请结合原账单核对。",
        tone: "orange",
      },
    ],
    actions: [
      { label: "确认忽略此消息", target: "payment-inbox" },
      { label: "继续核对", target: "payment-review", secondary: true },
    ],
    sources: [
      "apps/mobile/src/screens/PaymentReceiptCard.tsx",
      "apps/mobile/src/screens/PaymentInboxScreen.tsx",
    ],
    intent: "消息处理与账单生命周期区别清楚。",
  },
  {
    id: "payment-clear",
    title: "清空本机收件箱？",
    group: "支付通知 · Android",
    nav: "mine",
    mobileOnly: true,
    layout: "state",
    subtitle: "仅影响本机支付候选消息",
    blocks: [
      {
        kind: "notice",
        heading: "未确认消息不在普通备份中",
        text: "清空后，尚未核对的消息可能无法从账本恢复。已经入账的账单继续保留。",
        tone: "orange",
      },
      {
        kind: "fields",
        items: [
          {
            label: "我已核对需要保留的支付消息",
            value: "未勾选",
            type: "toggle",
          },
        ],
      },
    ],
    actions: [
      { label: "确认清空收件箱", target: "payment-inbox" },
      { label: "先返回核对", target: "payment-inbox", secondary: true },
    ],
    sources: [
      "apps/mobile/src/screens/PaymentInboxSettings.tsx",
      "apps/mobile/src/screens/PaymentInboxScreen.tsx",
    ],
    intent: "清空前说明未入账消息与归档的边界，并要求明确确认。",
  },
  {
    id: "payment-permission",
    title: "还差一次系统授权",
    group: "支付通知 · Android",
    nav: "mine",
    mobileOnly: true,
    layout: "state",
    subtitle: "通知使用权尚未授予",
    blocks: [
      {
        kind: "notice",
        heading: "允许发送通知，并不能读取支付消息",
        text: "需要在系统中授予通知使用权，再回到应用检查监听连接。只采集勾选来源的支付候选。",
        tone: "orange",
      },
      {
        kind: "list",
        items: [
          { label: "通知使用权", value: "未授权", icon: "lock" },
          { label: "监听连接", value: "未连接", icon: "warning" },
        ],
      },
    ],
    actions: [
      { label: "打开系统授权入口", target: "payment-settings" },
      { label: "先使用手动记账", target: "entry", secondary: true },
    ],
    sources: ["apps/mobile/src/screens/PaymentInboxSettings.tsx"],
    intent: "把权限缺失、监听连接与普通通知权限区分开。",
  },
];
