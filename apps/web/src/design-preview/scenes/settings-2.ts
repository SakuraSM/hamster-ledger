import type { SceneSpec } from "../model";
export const settingsScenes2: SceneSpec[] = [
  {
    id: "preferences",
    title: "合你的记账习惯",
    group: "数据与设置",
    nav: "mine",
    subtitle: "偏好设置",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "每月账期开始日", value: "1 日", type: "select" },
          { label: "隐藏金额", value: "关", type: "toggle" },
          { label: "每日提醒", value: "开", type: "toggle" },
          { label: "提醒时间", value: "21:00", type: "select" },
        ],
      },
      {
        kind: "list",
        items: [
          { label: "外观", value: "纸白", icon: "eye", target: "theme" },
          {
            label: "隐私保护",
            value: "查看",
            icon: "shield",
            target: "privacy",
          },
          { label: "回收站", value: "2 笔", icon: "trash", target: "trash" },
        ],
      },
    ],
    actions: [{ label: "保存偏好", target: "tools" }],
    sources: [
      "apps/web/src/components/settings/PreferencesPanel.tsx",
      "apps/mobile/src/screens/PreferencesScreen.tsx",
    ],
    intent: "常用开关一屏完成，隐私和通知诊断另设入口。",
  },
  {
    id: "theme",
    title: "给账页换个外观",
    group: "数据与设置",
    nav: "mine",
    subtitle: "统一金额语义与对比度",
    blocks: [
      {
        kind: "themes",
        items: [
          { label: "纸白", selected: true },
          { label: "青橄榄" },
          { label: "夜读", target: "night" },
        ],
      },
      {
        kind: "fields",
        items: [{ label: "金额显示", value: "显示", type: "select" }],
      },
      {
        kind: "notice",
        text: "主题变化保留文字状态与操作位置，不靠颜色判断收支与风险。",
      },
    ],
    actions: [{ label: "应用外观", target: "tools" }],
    sources: [
      "apps/web/src/components/settings/PreferencesPanel.tsx",
      "apps/mobile/src/screens/PreferencesScreen.tsx",
    ],
    intent: "先看同一内容的预览，再应用主题。",
  },
  {
    id: "privacy",
    title: "账本的边界，你清楚",
    group: "数据与设置",
    nav: "mine",
    subtitle: "保存位置与数据保护",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "本机账本",
            note: "保存在当前设备，可离线编辑",
            icon: "lock",
          },
          {
            label: "个人同步",
            note: "自行连接服务器，冲突时保留两边",
            icon: "globe",
            target: "sync",
          },
          {
            label: "联网共同账本",
            note: "在线保存，离线仅查看缓存",
            icon: "users",
            target: "network",
          },
          {
            label: "密码保护",
            value: "管理",
            note: "Web 本机保险库",
            icon: "shield",
            target: "vault-setup",
          },
        ],
      },
      {
        kind: "notice",
        text: "服务器账本并非端到端加密。模型凭据、归档密码和账号密码各自有不同用途。",
      },
    ],
    actions: [{ label: "管理备份", target: "backup" }],
    sources: [
      "apps/web/src/components/settings/PrivacyPanel.tsx",
      "apps/mobile/src/screens/PreferencesScreen.tsx",
    ],
    intent: "解释保存位置与保护范围，减少对“加密”一词的误解。",
  },
  {
    id: "trash",
    title: "删掉的，也留个退路",
    group: "数据与设置",
    nav: "mine",
    subtitle: "回收站 · 2 笔示例账单",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "旧的测试记录",
            value: "¥12.00",
            note: "11月3日 · 已删除",
            icon: "trash",
            target: "deleted-record",
          },
          {
            label: "重复补记",
            value: "¥24.00",
            note: "11月2日 · 已删除",
            icon: "trash",
            target: "deleted-record",
          },
        ],
      },
      {
        kind: "notice",
        text: "已删除记录不计入汇总。恢复时关联流水一起恢复。",
        tone: "olive",
      },
    ],
    actions: [{ label: "查看一笔并恢复", target: "deleted-record" }],
    sources: [
      "apps/web/src/components/settings/ToolsPage.tsx",
      "apps/mobile/src/screens/TransactionsScreen.tsx",
    ],
    intent: "用删除状态与恢复入口表达可逆性，避免混入普通账单列表。",
  },
  {
    id: "deleted-record",
    title: "这笔已移入回收站",
    group: "数据与设置",
    nav: "mine",
    subtitle: "已删除 · 不计入收支",
    hero: "¥12.00",
    heroLabel: "旧的测试记录",
    blocks: [
      {
        kind: "list",
        items: [
          { label: "原交易时间", value: "2026-11-03", icon: "calendar" },
          { label: "分类与账户", value: "其他 · 现金", icon: "wallet" },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        text: "恢复后，符合条件的账单会重新参与汇总。关联流水也会恢复。",
      },
    ],
    actions: [{ label: "恢复这笔账单", target: "restore-record-done" }],
    sources: [
      "apps/web/src/components/RecordDetail.tsx",
      "apps/mobile/src/screens/RecordDetail.tsx",
    ],
    intent: "恢复前明确说明会改变统计，保留原时间与账户。",
  },
  {
    id: "attachment-cleanup",
    title: "清理前，先看范围",
    group: "数据与设置",
    nav: "mine",
    subtitle: "只处理未被引用的旧附件",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "可以清理",
            note: "超过24小时且未被账单或草稿引用",
            icon: "trash",
          },
          {
            label: "继续保留",
            note: "回收站、已入账记录与待确认草稿的凭证",
            icon: "shield",
          },
        ],
      },
      { kind: "notice", text: "清理不会删除账单，也不会删除仍在使用的凭证。" },
    ],
    actions: [
      { label: "清理未使用附件", target: "cleanup-done" },
      { label: "取消", target: "backup", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "具体解释清理条件，避免让用户误以为所有旧凭证都会删除。",
  },
];
