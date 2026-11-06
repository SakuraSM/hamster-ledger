import type { SceneSpec } from "../model";
export const workspaceScenes1: SceneSpec[] = [
  {
    id: "tools",
    title: "我的账本工具",
    group: "账本与协作",
    nav: "mine",
    subtitle: "生活账 · 本机保存，可离线编辑",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "常用", selected: true },
          { label: "数据" },
          { label: "设置" },
        ],
      },
      {
        kind: "list",
        heading: "常用入口",
        items: [
          { label: "资产与账户", icon: "wallet", target: "assets" },
          { label: "预算与计划", icon: "target", target: "budgets" },
          { label: "日历与报表", icon: "chart", target: "reports" },
          { label: "账本与家人", icon: "users", target: "books" },
          { label: "备份与同步", icon: "lock", target: "backup" },
          {
            label: "分类、偏好与隐私",
            icon: "settings",
            target: "preferences",
          },
        ],
      },
    ],
    actions: [{ label: "导入账单", target: "import" }],
    sources: [
      "apps/web/src/components/settings/ToolsPage.tsx",
      "apps/mobile/src/screens/ToolsScreen.tsx",
    ],
    intent: "把长工具列表按任务聚合，常用入口只占一屏。",
  },
  {
    id: "books",
    title: "一本账，一段生活",
    group: "账本与协作",
    nav: "mine",
    subtitle: "切换账本时，余额与流水各自独立",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "生活账",
            value: "当前",
            note: "本机 · 可离线编辑",
            icon: "book",
            target: "book-edit",
          },
          {
            label: "和家人的账",
            value: "3 人",
            note: "联网 · 断网时仅查看缓存",
            icon: "users",
            target: "network",
          },
          {
            label: "旅行小账",
            value: "已连接",
            note: "个人同步 · 前台自动同步",
            icon: "globe",
            target: "sync",
          },
          {
            label: "已归档账本",
            value: "1 本",
            icon: "book",
            target: "book-edit",
          },
        ],
      },
    ],
    actions: [{ label: "新建账本", target: "book-edit" }],
    sources: [
      "apps/web/src/components/settings/BooksPanel.tsx",
      "apps/mobile/src/screens/BooksScreen.tsx",
    ],
    intent: "让保存位置和离线能力成为每本账可读的属性。",
  },
  {
    id: "book-edit",
    title: "给账本起个名字",
    group: "账本与协作",
    nav: "mine",
    subtitle: "账本管理",
    blocks: [
      { kind: "fields", items: [{ label: "账本名称", value: "生活账" }] },
      {
        kind: "list",
        items: [
          {
            label: "保存方式",
            value: "本机",
            note: "数据保存在当前设备",
            icon: "lock",
          },
          {
            label: "归档账本",
            value: "管理",
            note: "账单保留，可随时恢复",
            icon: "book",
            target: "archive-confirm",
          },
        ],
      },
    ],
    actions: [
      { label: "保存名称", target: "books" },
      { label: "返回账本列表", target: "books", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BooksPanel.tsx",
      "apps/mobile/src/screens/BooksScreen.tsx",
    ],
    intent: "名称编辑与归档清楚分离，避免危险操作贴近主按钮。",
  },
  {
    id: "sync",
    title: "两边的账，接得上",
    group: "账本与协作",
    nav: "mine",
    subtitle: "旅行小账 · 个人快照同步",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "已连接 · 当前已同步",
        text: "页面打开或应用前台时尝试自动同步。",
      },
      {
        kind: "list",
        items: [
          { label: "保存位置", value: "本机 + 你的服务器", icon: "globe" },
          { label: "最近同步", value: "今天 17:20", icon: "clock" },
          { label: "云端版本", value: "12", icon: "receipt" },
        ],
      },
      {
        kind: "notice",
        text: "仅云端变化时自动获取；双方都有修改时保留两边。离线可继续编辑本机账本。",
      },
    ],
    actions: [
      { label: "立即同步", target: "connection-success" },
      { label: "查看冲突示例", target: "sync-conflict", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/SyncPanel.tsx",
      "apps/mobile/src/screens/SyncScreen.tsx",
    ],
    intent: "状态、最近时间和冲突处理原则先于操作按钮。",
  },
  {
    id: "sync-conflict",
    title: "两份修改，都保留",
    group: "账本与协作",
    nav: "mine",
    subtitle: "本机和云端都发生了变化",
    blocks: [
      {
        kind: "comparison",
        items: [
          {
            label: "本机版本",
            value: "8 笔账单",
            note: "本机新增了1笔 · 数据保留",
            icon: "book",
          },
          {
            label: "云端版本 13",
            value: "9 笔账单",
            note: "今天 17:25 · 3个账户",
            icon: "globe",
          },
        ],
      },
      {
        kind: "notice",
        heading: "自动同步已停止",
        text: "先把云端版本恢复成新账本再核对，原本机账本不会被覆盖。",
        tone: "orange",
      },
    ],
    actions: [
      { label: "云端恢复为新账本", target: "restore-done" },
      { label: "保留本机，稍后处理", target: "sync", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/SyncPanel.tsx",
      "apps/mobile/src/screens/SyncScreen.tsx",
    ],
    intent: "不把覆盖当作默认选项；两份版本差异和安全结果同时展示。",
  },
];
