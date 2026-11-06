import type { SceneSpec } from "../model";
export const paymentScenes: SceneSpec[] = [
  {
    id: "payment-inbox",
    title: "支付消息，先放这里",
    group: "支付通知 · Android",
    nav: "inbox",
    mobileOnly: true,
    subtitle: "本机通知收件箱 · 核对后才入账",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "系统监听已连接",
        text: "已授权 · 仅采集勾选的来源",
      },
      {
        kind: "list",
        items: [
          {
            label: "微信支付",
            value: "¥18.00",
            note: "今天 09:20 · 待确认",
            icon: "receipt",
            target: "payment-review",
          },
          {
            label: "支付宝",
            value: "¥32.00",
            note: "今天 12:10 · 待确认",
            icon: "receipt",
            target: "payment-review",
          },
        ],
      },
      {
        kind: "notice",
        text: "未确认消息仅在本机加密保存，不计收支，也不参与普通账本同步或备份。",
      },
    ],
    actions: [
      { label: "核对下一条", target: "payment-review" },
      { label: "采集与权限设置", target: "payment-settings", secondary: true },
    ],
    sources: ["apps/mobile/src/screens/PaymentInboxScreen.tsx"],
    intent: "把来源、监听状态和未入账属性放在消息列表之前。",
  },
  {
    id: "payment-review",
    title: "核对这条支付消息",
    group: "支付通知 · Android",
    nav: "inbox",
    mobileOnly: true,
    subtitle: "微信支付 · 原始通知保留在本机",
    hero: "¥18.00",
    heroLabel: "候选金额 · 未入账",
    blocks: [
      {
        kind: "notice",
        heading: "原始通知",
        text: "支付成功，实付18.00元。以上是合成通知文本。",
      },
      {
        kind: "fields",
        items: [
          { label: "交易名称", value: "街角咖啡" },
          { label: "分类", value: "餐饮", type: "select" },
          { label: "付款账户", value: "请选择实际账户", type: "select" },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        text: "支付平台不等于出资账户，请根据实际付款方式确认。",
      },
    ],
    actions: [
      { label: "确认并入账", target: "payment-recovery" },
      { label: "关联已有账单", target: "duplicate", secondary: true },
      { label: "忽略这条消息", target: "payment-discard", secondary: true },
    ],
    sources: ["apps/mobile/src/screens/PaymentReceiptReview.tsx"],
    intent: "原文、候选金额和实际账户依次核对，绝不自动推断出资账户。",
  },
  {
    id: "payment-settings",
    title: "决定采集哪些消息",
    group: "支付通知 · Android",
    nav: "mine",
    mobileOnly: true,
    subtitle: "Android 支付通知设置",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "采集支付消息", value: "开", type: "toggle" },
          { label: "微信支付通知", value: "已勾选", type: "toggle" },
          { label: "支付宝通知", value: "已勾选", type: "toggle" },
          { label: "目标账本", value: "生活账 · 本机", type: "select" },
        ],
      },
      {
        kind: "list",
        items: [
          { label: "通知使用权", value: "已授权", icon: "shield" },
          { label: "系统连接", value: "已连接", icon: "check" },
          {
            label: "清空本机收件箱",
            value: "先核对影响",
            icon: "trash",
            target: "payment-clear",
          },
        ],
      },
      {
        kind: "notice",
        text: "未出现的通知、未勾选的来源或省电限制，都可能导致未采集。仍需以原账单对账。",
      },
    ],
    actions: [
      { label: "保存采集设置", target: "payment-inbox" },
      {
        label: "打开系统授权设置",
        target: "payment-settings",
        secondary: true,
      },
    ],
    sources: ["apps/mobile/src/screens/PaymentInboxSettings.tsx"],
    intent: "权限和监听连接是两种状态，给出可读的诊断。",
  },
  {
    id: "payment-recovery",
    title: "这条消息已经处理",
    group: "支付通知 · Android",
    nav: "inbox",
    mobileOnly: true,
    subtitle: "已关联账单 · 原始消息仍可查看",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "街角咖啡",
            value: "¥18.00",
            note: "已确认 · 今天 09:20",
            icon: "check",
            target: "record",
          },
          { label: "处理方式", value: "确认入账", icon: "receipt" },
        ],
      },
      {
        kind: "notice",
        text: "重复处理不会创建第二笔。需要修改时先打开关联账单。",
        tone: "olive",
      },
    ],
    actions: [
      { label: "打开关联账单", target: "record" },
      { label: "返回收件箱", target: "payment-inbox", secondary: true },
    ],
    sources: ["apps/mobile/src/screens/PaymentReceiptRecovery.tsx"],
    intent: "处理回执可追踪到关联账单，避免重复确认。",
  },
  {
    id: "reminder-diagnostics",
    title: "提醒能不能送到",
    group: "支付通知 · Android",
    nav: "mine",
    mobileOnly: true,
    subtitle: "系统权限与任务诊断",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "系统通知权限", value: "已允许", icon: "shield" },
          { label: "每日提醒任务", value: "已安排 · 21:00", icon: "clock" },
          { label: "通知通道", value: "已启用", icon: "bell" },
        ],
      },
      {
        kind: "notice",
        heading: "仍需实际设备验证",
        text: "省电限制、锁屏显示和重启后的实际送达，需要在这台设备测试。状态正常不等于已经成功送达。",
      },
    ],
    actions: [
      { label: "刷新诊断状态", target: "reminder-diagnostics" },
      { label: "返回提醒设置", target: "preferences", secondary: true },
    ],
    sources: [
      "apps/mobile/src/screens/PreferencesScreen.tsx",
      "apps/mobile/src/platform/reminders.ts",
    ],
    intent: "诊断展示事实与边界，不给“必达”的误导性承诺。",
  },
];
