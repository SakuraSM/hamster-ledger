import type { SceneSpec } from "../model";
export const feedbackScenes1: SceneSpec[] = [
  {
    id: "connection-success",
    title: "连接状态已确认",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "服务器已响应 · 示例状态",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "可以继续使用账号与同步能力。连接成功本身不代表模型识别质量或生产验收。",
      },
    ],
    actions: [{ label: "返回同步", target: "sync" }],
    sources: [
      "apps/web/src/components/settings/SyncPanel.tsx",
      "apps/mobile/src/screens/SyncScreen.tsx",
    ],
    intent: "准确表达连接层面的成功，不夸大结果。",
  },
  {
    id: "notifications-read",
    title: "提醒都看过了",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "0 条未读 · 原提醒仍可查看",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "标为已读不会删除提醒，也不会修改相关账单。",
      },
    ],
    actions: [{ label: "查看全部提醒", target: "notifications" }],
    sources: [
      "apps/web/src/components/finance/PlanningPanel.tsx",
      "apps/mobile/src/screens/PlanningScreen.tsx",
    ],
    intent: "已读与删除是不同状态。",
  },
  {
    id: "session-revoked",
    title: "这台设备已退出",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "其他设备的会话已撤销",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "当前设备仍可继续使用。被撤销的设备需要重新登录。",
      },
    ],
    actions: [{ label: "返回账号与设备", target: "sessions" }],
    sources: [
      "apps/web/src/components/auth/AccountSecurityPanel.tsx",
      "apps/mobile/src/screens/AccountScreen.tsx",
    ],
    intent: "说明退出的设备范围，避免误以为全部被登出。",
  },
  {
    id: "restore-record-done",
    title: "账单已经恢复",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "关联流水也一起恢复",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "符合入账条件的记录重新参与汇总，可以打开详情继续核对。",
      },
    ],
    actions: [
      { label: "查看恢复的账单", target: "record" },
      { label: "返回回收站", target: "trash", secondary: true },
    ],
    sources: [
      "apps/web/src/components/RecordDetail.tsx",
      "apps/mobile/src/screens/RecordDetail.tsx",
    ],
    intent: "恢复结果指向可验证的对象。",
  },
  {
    id: "cleanup-done",
    title: "未使用附件已清理",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "清理了2张示例附件",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        text: "账单、待确认草稿和回收站中仍被引用的凭证继续保留。",
      },
    ],
    actions: [{ label: "返回备份与附件", target: "backup" }],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "结果给出数量与保留范围。",
  },
  {
    id: "backup-error",
    title: "这份备份暂时打不开",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "密码错误、文件损坏或版本不受支持",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        heading: "当前账本没有改变",
        text: "核对备份密码后重试，或选择另一份完整备份。",
      },
      {
        kind: "fields",
        items: [{ label: "备份密码", value: "", type: "password" }],
      },
    ],
    actions: [
      { label: "重试解密", target: "restore" },
      { label: "选择其他备份", target: "backup", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "密码错误不丢数据，也不让用户重复进行恢复写入。",
  },
  {
    id: "login-error",
    title: "还没能登录",
    group: "状态与反馈",
    nav: "mine",
    layout: "auth",
    subtitle: "账号或密码不匹配 · 示例状态",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        text: "请核对账号和密码。多次失败时需按提示等待后重试。",
      },
      {
        kind: "fields",
        items: [
          { label: "账号", value: "示例用户" },
          { label: "密码", value: "", type: "password" },
        ],
      },
    ],
    actions: [
      { label: "重新登录", target: "login" },
      { label: "先在本机使用", target: "onboarding", secondary: true },
    ],
    sources: [
      "apps/web/src/components/auth/AuthForm.tsx",
      "apps/mobile/src/screens/AccountScreen.tsx",
    ],
    intent: "错误说明紧邻字段，并保留可用的本机路径。",
  },
  {
    id: "model-error",
    title: "这次识别没有完成",
    group: "状态与反馈",
    nav: "inbox",
    layout: "state",
    subtitle: "输入与附件仍保留在草稿",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        text: "服务暂不可用。可以检查模型配置后重试，或手动记账。失败不会生成假账单。",
      },
    ],
    actions: [
      { label: "检查模型配置", target: "model" },
      { label: "改为手动记账", target: "entry", secondary: true },
    ],
    sources: [
      "apps/web/src/components/ai/AiPanel.tsx",
      "apps/mobile/src/screens/AiScreen.tsx",
    ],
    intent: "模型失败仍然有可执行的人工路径。",
  },
  {
    id: "unsaved",
    title: "这张草稿还没保存",
    group: "状态与反馈",
    nav: "ledger",
    layout: "state",
    subtitle: "离开前，决定如何处理",
    blocks: [
      {
        kind: "notice",
        text: "继续编辑可以保留当前输入；放弃后不会新增账单。",
        tone: "orange",
      },
    ],
    actions: [
      { label: "继续编辑", target: "entry" },
      { label: "放弃草稿", target: "transactions", secondary: true },
    ],
    sources: [
      "apps/mobile/src/ui/FormSheet.tsx",
      "apps/web/src/components/Dialog.tsx",
    ],
    intent: "草稿退出有明确的留在原地和放弃两条路径。",
  },
];
