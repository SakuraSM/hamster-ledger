import type { SceneSpec } from "../model";
export const workspaceScenes3: SceneSpec[] = [
  {
    id: "ownership",
    title: "转移账本所有权",
    group: "账本与协作",
    nav: "mine",
    subtitle: "这是需要明确确认的变更",
    blocks: [
      {
        kind: "fields",
        items: [{ label: "新所有者", value: "小林", type: "select" }],
      },
      {
        kind: "notice",
        tone: "red",
        heading: "转移后权限会变化",
        text: "请核对接收人。转移会改变管理能力，已有账单与操作历史仍保留。",
      },
      {
        kind: "fields",
        items: [
          { label: "我已核对接收人和影响", value: "未勾选", type: "toggle" },
        ],
      },
    ],
    actions: [{ label: "确认转移所有权", target: "members" }],
    sources: [
      "apps/web/src/components/settings/NetworkOwnership.tsx",
      "apps/mobile/src/screens/NetworkOwnershipSection.tsx",
    ],
    intent: "接收人、密码与影响分组展示，禁止手势直接提交。",
  },
  {
    id: "activity",
    title: "每次修改，有迹可循",
    group: "账本与协作",
    nav: "mine",
    subtitle: "和家人的账 · 操作历史",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "我 · 新增午餐账单",
            value: "¥32.00",
            note: "今天 12:10 · 版本12",
            icon: "receipt",
          },
          {
            label: "小林 · 修改分类",
            value: "餐饮",
            note: "今天 12:08 · 版本11",
            icon: "tag",
          },
          {
            label: "我 · 调整成员权限",
            value: "小周",
            note: "昨天 20:30 · 成员",
            icon: "users",
          },
        ],
      },
      {
        kind: "notice",
        text: "记录展示操作人、时间与变更，不包含密码或令牌。",
      },
    ],
    actions: [{ label: "返回共同账本", target: "network" }],
    sources: [
      "apps/web/src/components/settings/NetworkPanel.tsx",
      "apps/mobile/src/screens/NetworkScreen.tsx",
    ],
    intent: "按时间展开操作与对象，避免把版本号当作主要信息。",
  },
  {
    id: "open-tokens",
    title: "给自动化一把钥匙",
    group: "账本与协作",
    nav: "mine",
    subtitle: "开放接口 · 授权范围由你决定",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "令牌名称", value: "我的自动化" },
          { label: "授权账本", value: "和家人的账", type: "select" },
          { label: "有效期", value: "30天", type: "select" },
        ],
      },
      {
        kind: "choices",
        heading: "能力范围",
        items: [{ label: "读取", selected: true }, { label: "写入" }],
      },
      {
        kind: "notice",
        tone: "orange",
        text: "令牌生成后仅显示一次。此处为设计示例，不展示真实凭据。",
      },
    ],
    actions: [{ label: "创建访问令牌", target: "token-created" }],
    sources: [
      "apps/web/src/components/settings/OpenTokensPanel.tsx",
      "apps/mobile/src/screens/OpenTokensSection.tsx",
    ],
    intent: "明确账本、能力与有效期，令牌的危险性不靠红色单独表达。",
  },
  {
    id: "token-created",
    title: "令牌已创建",
    group: "账本与协作",
    nav: "mine",
    subtitle: "一次性展示 · 演示状态",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        heading: "现在保存到安全位置",
        text: "离开后无法再次查看原始令牌。",
      },
      {
        kind: "fields",
        items: [
          {
            label: "访问令牌",
            value: "DEMO-TOKEN-NOT-VALID",
            type: "password",
          },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "我的自动化",
            value: "只读",
            note: "和家人的账 · 30天后过期",
            icon: "shield",
          },
        ],
      },
    ],
    actions: [
      { label: "我已妥善保存", target: "open-tokens" },
      { label: "撤销令牌", target: "open-tokens", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/OpenTokensPanel.tsx",
      "apps/mobile/src/screens/OpenTokensSection.tsx",
    ],
    intent: "一次性秘密有明确的离开提示，示例令牌不可真实使用。",
  },
];
