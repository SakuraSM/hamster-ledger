import type { SceneSpec } from "../model";
const stateSources = [
  "apps/web/src/ui/LedgerViewBoundary.tsx",
  "apps/mobile/src/ui/LedgerViewBoundary.tsx",
];
export const stateScenes1: SceneSpec[] = [
  {
    id: "empty",
    title: "账页还空着",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "从今天的第一笔开始",
    blocks: [
      {
        kind: "notice",
        text: "可以手动记账，也可以导入已有账单。先建立余额基准，资产变化会更清楚。",
        tone: "olive",
      },
    ],
    actions: [
      { label: "记第一笔", target: "entry" },
      { label: "导入账单", target: "import", secondary: true },
    ],
    sources: [
      "apps/web/src/components/Overview.tsx",
      "apps/mobile/src/screens/OverviewScreen.tsx",
    ],
    intent: "空状态提供两个明确入口，不把空值装饰成假数据。",
  },
  {
    id: "offline",
    title: "暂时离线，账还在",
    group: "状态与反馈",
    nav: "ledger",
    subtitle: "个人本机 / 同步账本 · 可继续编辑",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        heading: "同步服务暂不可用",
        text: "当前本机修改已保留，恢复连接后再检查云端变化。",
      },
      {
        kind: "list",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "本机已保存",
            icon: "food",
            target: "record",
          },
          {
            label: "打车",
            value: "−¥24.00",
            note: "本机已保存",
            icon: "car",
            target: "record",
          },
        ],
      },
    ],
    actions: [
      { label: "继续在本机记账", target: "entry" },
      { label: "重新连接", target: "sync", secondary: true },
    ],
    sources: ["apps/web/src/App.tsx", "apps/mobile/src/screens/SyncScreen.tsx"],
    intent: "离线不等于所有模式都能编辑；此处明确是本机或个人同步账本。",
  },
  {
    id: "readonly",
    title: "离线时，先看看",
    group: "状态与反馈",
    nav: "ledger",
    subtitle: "家庭联网账本 · 缓存只读",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        heading: "暂不能保存修改",
        text: "联网账本离线时仅可查看缓存，恢复连接后继续操作。",
      },
      {
        kind: "list",
        items: [
          {
            label: "午餐",
            value: "−¥32.00",
            note: "缓存记录 · 版本12",
            icon: "food",
            target: "record",
          },
          { label: "成员与权限", value: "稍后刷新", icon: "users" },
        ],
      },
    ],
    actions: [
      { label: "重新连接账本", target: "network" },
      { label: "切换本机账本", target: "books", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "把只读原因放在操作前，避免先填完表单再告知无法保存。",
  },
  {
    id: "loading",
    title: "正在打开这本账",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "等待本机存储读取完成",
    blocks: [
      {
        kind: "progress",
        value: "40",
        caption: "示例加载状态 · 正在读取账单与账户",
      },
      {
        kind: "notice",
        text: "读取完成前停止写入，避免把尚未加载的数据覆盖。",
      },
    ],
    actions: [{ label: "查看读取完成状态", target: "overview" }],
    sources: [
      "apps/web/src/components/auth/AuthEntry.tsx",
      "apps/mobile/src/ui/LedgerLoading.tsx",
    ],
    intent: "有含义的加载文案和只读边界，不展示假账单。",
  },
  {
    id: "error",
    title: "此页暂时算不出来",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "账本数据已保留",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        heading: "请检查金额、基准或汇率",
        text: "可以先导出备份，或切换账本再核对。当前错误不会自动修改账本。",
      },
    ],
    actions: [
      { label: "打开备份", target: "backup" },
      { label: "重试页面", target: "overview", secondary: true },
    ],
    sources: stateSources,
    intent: "失败页提供恢复路径，避免只剩报错和刷新。",
  },
  {
    id: "delete-confirm",
    title: "移入回收站？",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "午餐 · ¥32.00",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        text: "这笔账单及关联流水会移入回收站，不再计入汇总。可以撤销或稍后恢复。",
      },
    ],
    actions: [
      { label: "确认移入回收站", target: "deleted" },
      { label: "继续保留", target: "record", secondary: true },
    ],
    sources: [
      "apps/web/src/components/RecordDetail.tsx",
      "apps/mobile/src/screens/RecordDetail.tsx",
    ],
    intent: "具体对象、影响和可逆性都在确认按钮前说清楚。",
  },
  {
    id: "confirmed",
    title: "这一笔，已经记好",
    group: "状态与反馈",
    nav: "inbox",
    layout: "state",
    subtitle: "街角咖啡 · 已入账",
    hero: "¥18.00",
    heroLabel: "确认成功",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "本月支出更新为", value: "¥1,304.40" },
          { label: "待处理还剩", value: "2 笔" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "原始凭证已关联。撤销可以恢复确认前的状态。",
      },
    ],
    actions: [
      { label: "核对下一笔", target: "duplicate" },
      { label: "撤销本次确认", target: "inbox", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ai/AiPanel.tsx",
      "apps/mobile/src/screens/AiScreen.tsx",
    ],
    intent: "反馈紧贴金额变化，下一笔和撤销同时可达。",
  },
  {
    id: "entry-saved",
    title: "已保存，可以接着记",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "输入草稿已清空，分类和账户保留",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "账单已保存",
        text: "继续记下一笔，或返回账单核对。",
      },
    ],
    actions: [
      { label: "继续记下一笔", target: "entry" },
      { label: "查看账单", target: "transactions", secondary: true },
    ],
    sources: [
      "apps/web/src/components/SimpleEntryEditor.tsx",
      "apps/mobile/src/screens/SimpleEntryEditor.tsx",
    ],
    intent: "连续记账成功状态不自动关闭编辑器，也不重复提交上一笔。",
  },
];
