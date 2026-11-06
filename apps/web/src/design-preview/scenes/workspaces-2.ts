import type { SceneSpec } from "../model";
export const workspaceScenes2: SceneSpec[] = [
  {
    id: "network",
    title: "和家人记在一起",
    group: "账本与协作",
    nav: "mine",
    subtitle: "和家人的账 · 已连接",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "在线编辑",
        text: "更改提交到服务器；断网时可查看缓存。",
      },
      {
        kind: "list",
        items: [
          {
            label: "账本成员",
            value: "3 人",
            icon: "users",
            target: "members",
          },
          {
            label: "邀请家人",
            value: "生成邀请",
            icon: "share",
            target: "invite",
          },
          {
            label: "操作历史",
            value: "查看",
            icon: "clock",
            target: "activity",
          },
          {
            label: "开放接口令牌",
            value: "管理",
            icon: "shield",
            target: "open-tokens",
          },
          {
            label: "加入其他账本",
            value: "输入邀请码",
            icon: "plus",
            target: "join-book",
          },
        ],
      },
    ],
    actions: [{ label: "邀请家人", target: "invite" }],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "联网状态常驻，成员、邀请、历史分开进入。",
  },
  {
    id: "invite",
    title: "邀请一个人",
    group: "账本与协作",
    nav: "mine",
    subtitle: "和家人的账 · 先选择权限",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "只读" },
          { label: "成员", selected: true },
          { label: "管理员" },
        ],
      },
      {
        kind: "notice",
        text: "成员可记账；只读成员可查看。管理员有更多管理能力。",
      },
      {
        kind: "fields",
        items: [{ label: "邀请有效期", value: "按服务配置", type: "select" }],
      },
      {
        kind: "notice",
        tone: "olive",
        text: "生成后再分享邀请码。示例页面不会生成真实邀请。",
      },
    ],
    actions: [{ label: "生成邀请", target: "invite-ready" }],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "先说明权力边界，再创建可分享的邀请。",
  },
  {
    id: "invite-ready",
    title: "邀请已经备好",
    group: "账本与协作",
    nav: "mine",
    subtitle: "演示邀请码 · 不可用于真实加入",
    hero: "DEMO-ONLY",
    heroLabel: "示例邀请",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "邀请到", value: "和家人的账", icon: "book" },
          { label: "授予权限", value: "成员", icon: "users" },
          { label: "有效期", value: "24 小时 · 示例", icon: "clock" },
        ],
      },
      {
        kind: "notice",
        text: "仅发送给你信任的人。可以在成员管理中查看加入结果。",
      },
    ],
    actions: [
      { label: "复制邀请说明", target: "members" },
      { label: "管理已有邀请", target: "members", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "用文字邀请表达能力，避免设计稿出现能被误用的真实令牌。",
  },
  {
    id: "join-book",
    title: "加入一本共同的账",
    group: "账本与协作",
    nav: "mine",
    subtitle: "使用对方分享的邀请码",
    blocks: [
      { kind: "fields", items: [{ label: "邀请码", value: "DEMO-ONLY" }] },
      {
        kind: "notice",
        heading: "先核对邀请信息",
        text: "确认账本和权限后再加入；本机已有账本会保留。",
      },
    ],
    actions: [{ label: "查看邀请信息", target: "network" }],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "加入前核对对象与权限，不把输入完成当作授权。",
  },
  {
    id: "members",
    title: "一起记账的人",
    group: "账本与协作",
    nav: "mine",
    subtitle: "和家人的账 · 3 人",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "我",
            value: "所有者",
            note: "管理账本与所有权",
            icon: "shield",
            target: "ownership",
          },
          {
            label: "小林",
            value: "管理员",
            note: "管理成员与账务",
            icon: "users",
            target: "member-role",
          },
          {
            label: "小周",
            value: "成员",
            note: "可记账",
            icon: "users",
            target: "member-role",
          },
        ],
      },
      {
        kind: "notice",
        text: "权限变更即时影响后续操作，已有操作记录继续保留。",
      },
    ],
    actions: [
      { label: "邀请新成员", target: "invite" },
      { label: "转移所有权", target: "ownership", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "身份与权限以文字表明，管理动作从成员行进入。",
  },
  {
    id: "member-role",
    title: "调整成员权限",
    group: "账本与协作",
    nav: "mine",
    subtitle: "小周 · 当前为成员",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "只读" },
          { label: "成员", selected: true },
          { label: "管理员" },
        ],
      },
      {
        kind: "notice",
        text: "只读可查看，成员可记账，管理员可管理账本成员。",
      },
    ],
    actions: [
      { label: "保存权限", target: "members" },
      { label: "移除成员", target: "member-remove", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "角色解释紧贴选择，移除成员作为次级危险操作。",
  },
];
