import type { SceneSpec } from "../model";
export const captureScenes1: SceneSpec[] = [
  {
    id: "inbox",
    title: "待处理",
    group: "记录与核对",
    nav: "inbox",
    layout: "receipt",
    subtitle: "核对后才会入账",
    counter: "03",
    blocks: [],
    actions: [
      { label: "确认并下一笔", target: "confirmed" },
      { label: "稍后处理", target: "ai-drafts", secondary: true },
    ],
    sources: [
      "apps/mobile/src/screens/AiScreen.tsx",
      "apps/web/src/components/ReviewPage.tsx",
    ],
    intent:
      "把 AI 草稿和导入核对汇入一条逐项确认队列；滑动只浏览，明确点击才入账。",
  },
  {
    id: "duplicate",
    title: "是同一笔吗",
    group: "记录与核对",
    nav: "inbox",
    subtitle: "核对 1 / 2 · 时间与金额一致",
    counter: "02",
    blocks: [
      {
        kind: "comparison",
        items: [
          {
            label: "账本中已有",
            value: "¥32.00",
            note: "午餐 · 11月6日 12:10",
            icon: "receipt",
          },
          {
            label: "新导入的流水",
            value: "¥32.00",
            note: "午餐 · 11月6日 12:10",
            icon: "upload",
          },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        heading: "关联后只计一笔",
        text: "原始来源均会保留。本月支出仍为 ¥1,286.40。",
      },
      {
        kind: "list",
        items: [
          {
            label: "匹配依据",
            value: "查看",
            note: "同额 · 同日 · 同交易名称",
            icon: "shield",
          },
        ],
      },
    ],
    actions: [
      { label: "关联为同一笔", target: "confirmed" },
      { label: "分别保留", target: "unpaired", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ReviewPage.tsx",
      "apps/mobile/src/screens/ReviewScreen.tsx",
    ],
    intent: "并排比较证据与计账影响，避免把滑动手势当作合并授权。",
  },
  {
    id: "unpaired",
    title: "这一笔待确认",
    group: "记录与核对",
    nav: "inbox",
    subtitle: "暂未找到明确的重复流水",
    hero: "¥24.00",
    heroLabel: "打车 · 未入账",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "交易时间", value: "11月6日 08:40" },
          { label: "收付款账户", value: "请选择账户", type: "select" },
          { label: "分类", value: "交通", type: "select" },
        ],
      },
      {
        kind: "list",
        heading: "可能相关",
        items: [
          {
            label: "出行支出",
            value: "¥24.00",
            note: "11月5日 · 点开查看原始信息",
            icon: "car",
            target: "record",
          },
        ],
      },
    ],
    actions: [
      { label: "确认独立入账", target: "confirmed" },
      { label: "选择已有流水关联", target: "duplicate", secondary: true },
    ],
    sources: [
      "apps/web/src/components/PendingReviewPanel.tsx",
      "apps/mobile/src/screens/PendingReviewCard.tsx",
    ],
    intent: "歧义账户由用户选择；独立确认和关联两条路径并列。",
  },
  {
    id: "ai-input",
    title: "把凭证放进来",
    group: "记录与核对",
    nav: "inbox",
    subtitle: "一句话、一张图，先变成草稿",
    blocks: [
      {
        kind: "fields",
        items: [
          {
            label: "描述账单",
            value: "今天午餐32元，现金支付",
            note: "可以分号或换行分隔多笔账单",
          },
        ],
      },
      {
        kind: "upload",
        heading: "图片 / 拍照",
        text: "一次最多 5 张，支持粘贴或拖入",
        items: [
          { label: "选择图片", icon: "image" },
          { label: "拍照", icon: "plus" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "生成草稿后默认仍需核对，确认前不计入收支。",
      },
    ],
    actions: [
      { label: "生成待确认草稿", target: "ai-drafts" },
      { label: "模型、隐私与自动入账", target: "ai-policy", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ai/AiPanel.tsx",
      "apps/mobile/src/screens/AiScreen.tsx",
    ],
    intent: "突出输入与凭证，隐私和模型配置从主操作中分离。",
  },
  {
    id: "ai-drafts",
    title: "AI 草稿",
    group: "记录与核对",
    nav: "inbox",
    subtitle: "1 笔待确认 · 还没有入账",
    counter: "01",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "街角咖啡",
            value: "−¥18.00",
            note: "截图识别 · 今天 09:20",
            icon: "coffee",
            target: "inbox",
          },
        ],
      },
      {
        kind: "notice",
        text: "识别到的账户、金额和日期都可以修改。",
        tone: "olive",
      },
      {
        kind: "choices",
        heading: "按来源查看",
        items: [
          { label: "全部", selected: true },
          { label: "文字" },
          { label: "图片" },
        ],
      },
    ],
    actions: [
      { label: "核对下一笔", target: "inbox" },
      { label: "继续添加凭证", target: "ai-input", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ai/AiPanel.tsx",
      "apps/mobile/src/screens/AiScreen.tsx",
    ],
    intent: "保留来源与未入账状态，一键进入逐张核对。",
  },
  {
    id: "model",
    title: "识别模型",
    group: "记录与核对",
    nav: "mine",
    subtitle: "凭据保存在你连接的服务器",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "配置名称", value: "我的识别服务" },
          { label: "接口地址", value: "https://model.example/v1" },
          { label: "模型", value: "选择可用模型", type: "select" },
          { label: "API 密钥", value: "", type: "password" },
          { label: "启用视觉能力", value: "开", type: "toggle" },
          { label: "允许局域网模型", value: "关", type: "toggle" },
        ],
      },
      {
        kind: "notice",
        text: "局域网访问还需要部署者授权。测试连接成功不代表识别质量已验证。",
      },
    ],
    actions: [
      { label: "保存配置", target: "ai-input" },
      { label: "测试连接", target: "connection-success", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ai/ModelSettingsPanel.tsx",
      "apps/mobile/src/screens/ModelSettingsPanel.tsx",
    ],
    intent: "配置与测试入口清晰分离，密钥保持不透明。",
  },
];
