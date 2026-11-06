import type { SceneSpec } from "../model";
export const stateScenes2: SceneSpec[] = [
  {
    id: "deleted",
    title: "已移入回收站",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "原始信息与关联流水仍保留",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "此记录不再计入汇总。撤销可以立即恢复。",
      },
    ],
    actions: [
      { label: "撤销删除", target: "record" },
      { label: "查看回收站", target: "trash", secondary: true },
    ],
    sources: [
      "apps/web/src/components/RecordDetail.tsx",
      "apps/mobile/src/screens/RecordDetail.tsx",
    ],
    intent: "成功反馈必须提供直接的反向操作。",
  },
  {
    id: "archive-confirm",
    title: "归档并保留历史？",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "现金账户 · ¥3,200.00",
    blocks: [
      {
        kind: "notice",
        text: "从本次确认时间起归档；以前的基准、账单与历史资产曲线仍保留。",
      },
    ],
    actions: [
      { label: "确认归档", target: "asset-archived" },
      { label: "返回账户", target: "account-detail", secondary: true },
    ],
    sources: [
      "apps/web/src/components/assets/AccountDetail.tsx",
      "apps/mobile/src/screens/AssetsScreen.tsx",
    ],
    intent: "归档说明当前范围与历史范围，避免与删除混淆。",
  },
  {
    id: "restore-done",
    title: "新账本已准备好",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "恢复为新账本 · 原账本保留",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "现在可以核对恢复结果",
        text: "先查看账单、账户与凭证，再决定如何使用这本账。",
      },
    ],
    actions: [
      { label: "打开恢复的账本", target: "overview" },
      { label: "查看全部账本", target: "books", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "恢复后给出核对入口，而不是用成功提示替代结果检查。",
  },
  {
    id: "backup-done",
    title: "备份已经生成",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "请确认下载或分享目标中已保存文件",
    blocks: [
      {
        kind: "list",
        items: [
          {
            label: "生活账.hamster",
            value: "密码加密",
            note: "账单、草稿与附件已打包",
            icon: "lock",
          },
        ],
      },
      {
        kind: "notice",
        tone: "orange",
        text: "生成完成不代表外部保存完成。请同时妥善保管备份密码。",
      },
    ],
    actions: [{ label: "返回备份管理", target: "backup" }],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "准确表达生成与保存的边界。",
  },
  {
    id: "backup-cancelled",
    title: "操作已取消",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "原账本保持不变",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "未提交的新账本附件已清理。可以稍后重新开始。",
      },
    ],
    actions: [{ label: "返回备份", target: "backup" }],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "取消结果确认原数据安全，避免让用户猜测是否完成。",
  },
  {
    id: "night",
    title: "待处理",
    group: "状态与反馈",
    nav: "inbox",
    layout: "receipt",
    subtitle: "夜读 · 核对后才会入账",
    counter: "03",
    blocks: [],
    actions: [
      { label: "确认并下一笔", target: "confirmed" },
      { label: "稍后处理", target: "ai-drafts", secondary: true },
    ],
    night: true,
    sources: [
      "apps/web/src/components/settings/PreferencesPanel.tsx",
      "apps/mobile/src/screens/PreferencesScreen.tsx",
    ],
    intent: "夜间保留金额对比、原图可读性与既有操作位置。",
  },
];
