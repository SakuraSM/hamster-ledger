import type { SceneSpec } from "../model";
export const authScenes2: SceneSpec[] = [
  {
    id: "unlock",
    webOnly: true,
    title: "打开你的仓鼠账本",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "Web 本机保险库已锁定",
    blocks: [
      {
        kind: "fields",
        items: [{ label: "本机解锁密码", value: "", type: "password" }],
      },
      {
        kind: "notice",
        text: "此密码保护当前浏览器中的账本，不是服务器账号密码。",
      },
    ],
    actions: [{ label: "解锁账本", target: "inbox" }],
    sources: ["apps/web/src/components/LockedApp.tsx"],
    intent: "锁定状态保持简洁，明确密码对应的保护对象。",
  },
  {
    id: "vault-setup",
    webOnly: true,
    title: "给本机账本加把锁",
    group: "开始与账号",
    nav: "mine",
    subtitle: "Web 本机保险库 · 密码不会上传",
    blocks: [
      {
        kind: "fields",
        items: [{ label: "本机解锁密码", value: "", type: "password" }],
      },
      {
        kind: "notice",
        tone: "orange",
        heading: "请妥善保管密码",
        text: "遗忘后无法直接解锁本机密文。请先生成可恢复的备份。",
      },
    ],
    actions: [
      { label: "启用本机密码保护", target: "unlock" },
      { label: "先去备份", target: "backup", secondary: true },
    ],
    sources: ["apps/web/src/components/settings/PrivacyPanel.tsx"],
    intent: "在启用前说明恢复边界，给出备份的具体入口。",
  },
  {
    id: "onboarding",
    title: "从一个真实余额开始",
    group: "开始与账号",
    nav: "mine",
    subtitle: "先建账户，再记今天的第一笔",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "建立余额基准",
            note: "选择账户和确认时间",
            icon: "wallet",
            target: "account-edit",
          },
          {
            label: "记一笔或导入账单",
            note: "分类、账户由你确认",
            icon: "receipt",
            target: "entry",
          },
          {
            label: "以后再决定是否同步",
            note: "本机、个人同步与联网账本各有边界",
            icon: "globe",
            target: "books",
          },
        ],
      },
    ],
    actions: [
      { label: "建立首个账户", target: "account-edit" },
      { label: "先看看示例账本", target: "overview", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/ToolsPage.tsx",
      "apps/mobile/src/screens/ToolsScreen.tsx",
    ],
    intent: "用三件可执行的小事解释账本初始状态。",
  },
];
