import type { SceneSpec } from "../model";
export const authScenes1: SceneSpec[] = [
  {
    id: "welcome",
    title: "把每一笔，存进小日子",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "仓鼠记账 · 让钱的来去清楚一点",
    blocks: [
      {
        kind: "choices",
        items: [{ label: "本机记账", selected: true }, { label: "登录同步" }],
      },
      {
        kind: "list",
        items: [
          {
            label: "先在本机开始",
            note: "离线可用，之后也能选择同步",
            icon: "book",
          },
          {
            label: "已有自己的服务器",
            note: "登录后再选择需要连接的账本",
            icon: "globe",
            target: "login",
          },
        ],
      },
    ],
    actions: [
      { label: "开始本机记账", target: "onboarding" },
      { label: "登录已有账号", target: "login", secondary: true },
    ],
    sources: [
      "apps/web/src/components/auth/AuthEntry.tsx",
      "apps/mobile/src/screens/AccountScreen.tsx",
    ],
    intent: "本机开始与登录同等清晰，不把账号当作记账前提。",
  },
  {
    id: "login",
    title: "接着记下生活",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "登录你的仓鼠记账服务",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "账号", value: "示例用户" },
          { label: "密码", value: "", type: "password" },
          { label: "记住登录", value: "个人设备上开启", type: "toggle" },
        ],
      },
      {
        kind: "notice",
        text: "账号密码由你连接的服务管理。忘记密码时联系服务管理员。",
      },
    ],
    actions: [
      { label: "登录", target: "inbox" },
      { label: "创建账号", target: "register", secondary: true },
    ],
    sources: [
      "apps/web/src/components/auth/AuthForm.tsx",
      "apps/mobile/src/auth/AccountForm.tsx",
    ],
    intent: "简短表单、清楚的密码用途与本机入口。",
  },
  {
    id: "register",
    title: "为自己的账，留个位置",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "服务允许注册时可创建账号",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "账号", value: "" },
          { label: "登录密码", value: "", type: "password" },
          { label: "确认密码", value: "", type: "password" },
        ],
      },
      {
        kind: "notice",
        text: "请使用符合服务要求的密码。注册完成后，由你决定是否连接本机账本。",
      },
    ],
    actions: [
      { label: "创建账号", target: "onboarding" },
      { label: "已有账号，去登录", target: "login", secondary: true },
    ],
    sources: [
      "apps/web/src/components/auth/AuthForm.tsx",
      "apps/mobile/src/auth/AccountForm.tsx",
    ],
    intent: "注册完成不等于上传本机账本，授权意图要明确。",
  },
  {
    id: "registration-closed",
    title: "这项服务暂未开放注册",
    group: "开始与账号",
    nav: "mine",
    layout: "state",
    subtitle: "可以先在本机开始记账",
    blocks: [
      {
        kind: "notice",
        heading: "已有账号可直接登录",
        text: "需要账号时请联系服务管理员。",
      },
    ],
    actions: [
      { label: "仅在本机使用", target: "onboarding" },
      { label: "返回登录", target: "login", secondary: true },
    ],
    sources: [
      "apps/web/src/components/auth/AuthPage.tsx",
      "apps/mobile/src/screens/AccountScreen.tsx",
    ],
    intent: "没有注册能力时仍有可走通的本机路径。",
  },
  {
    id: "connect",
    title: "连接你的服务",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "Android · 先确认服务地址",
    mobileOnly: true,
    blocks: [
      {
        kind: "fields",
        items: [{ label: "服务器地址", value: "https://ledger.example" }],
      },
      {
        kind: "notice",
        text: "仅连接你信任的服务。地址确认后再输入账号；切换服务会重新检查登录状态。",
      },
    ],
    actions: [
      { label: "连接并查看登录方式", target: "login" },
      { label: "继续在本机使用", target: "onboarding", secondary: true },
    ],
    sources: [
      "apps/mobile/src/screens/AccountScreen.tsx",
      "apps/mobile/src/auth/AccountForm.tsx",
    ],
    intent: "服务器与账号两个步骤分开，防止混淆凭据所属服务。",
  },
  {
    id: "password",
    title: "给账号换个新密码",
    group: "开始与账号",
    nav: "mine",
    layout: "auth",
    subtitle: "需要先修改密码才能继续使用联网能力",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "当前密码", value: "", type: "password" },
          { label: "新密码", value: "", type: "password" },
        ],
      },
      {
        kind: "notice",
        text: "账号密码不等于本机保险库密码，也不用于解密归档备份。",
      },
    ],
    actions: [{ label: "更新密码并继续", target: "sessions" }],
    sources: [
      "apps/web/src/components/auth/PasswordChangePage.tsx",
      "apps/mobile/src/auth/SecurityPanel.tsx",
    ],
    intent: "强制改密也说明原因与不同密码的作用域。",
  },
  {
    id: "sessions",
    title: "账号与设备",
    group: "开始与账号",
    nav: "mine",
    subtitle: "示例用户 · ledger.example",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "当前设备",
            value: "正在使用",
            note: "今天 17:00 · 本次会话",
            icon: "shield",
          },
          {
            label: "另一台设备",
            value: "退出此设备",
            note: "昨天 20:00 · 示例会话",
            icon: "lock",
            target: "session-revoked",
          },
          {
            label: "修改密码",
            value: "管理",
            icon: "lock",
            target: "password",
          },
          {
            label: "服务器状态",
            value: "已连接",
            icon: "globe",
            target: "connection-success",
          },
        ],
      },
    ],
    actions: [{ label: "退出当前账号", target: "login" }],
    sources: [
      "apps/web/src/components/auth/AccountSecurityPanel.tsx",
      "apps/mobile/src/auth/SecurityPanel.tsx",
    ],
    intent: "把账号、服务和会话放在同一页，退出范围有明确文字。",
  },
];
