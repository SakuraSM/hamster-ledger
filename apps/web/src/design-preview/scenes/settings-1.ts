import type { SceneSpec } from "../model";
export const settingsScenes1: SceneSpec[] = [
  {
    id: "backup",
    title: "把这本账，留一份",
    group: "数据与设置",
    nav: "mine",
    subtitle: "完整归档包含账本、草稿与凭证",
    blocks: [
      {
        kind: "notice",
        tone: "olive",
        heading: "最近生成 · 今天17:30",
        text: "生成不等于已保存，请确认文件落在安全位置。",
      },
      {
        kind: "fields",
        items: [
          { label: "使用密码加密", value: "开", type: "toggle" },
          { label: "备份密码", value: "", type: "password" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "选择归档或旧 JSON",
            note: "先预览，再恢复为新账本",
            icon: "upload",
            target: "restore",
          },
          {
            label: "CSV / Excel 导出",
            note: "适合查看与分享，不能替代完整归档",
            icon: "download",
            target: "ledger-export",
          },
          {
            label: "附件清理",
            note: "只清理超过24小时且未被引用的附件",
            icon: "trash",
            target: "attachment-cleanup",
          },
        ],
      },
    ],
    actions: [{ label: "生成加密完整备份", target: "backup-progress" }],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "加密选择、密码、最近生成与恢复预览建立清晰层级。",
  },
  {
    id: "restore",
    title: "先看看这份备份",
    group: "数据与设置",
    nav: "mine",
    subtitle: "恢复预览 · 生活账.hamster",
    blocks: [
      {
        kind: "metrics",
        items: [
          { label: "账单", value: "8 笔" },
          { label: "账户", value: "5 个" },
          { label: "凭证", value: "1 张" },
        ],
      },
      {
        kind: "notice",
        tone: "olive",
        heading: "会创建一个新账本",
        text: "当前账本完整保留，不被覆盖。",
      },
      {
        kind: "list",
        items: [
          {
            label: "文件校验",
            value: "通过",
            note: "格式与附件完整性已检查",
            icon: "shield",
          },
          {
            label: "归档内容",
            value: "可恢复",
            note: "不含账号、令牌、模型密钥或通知收件箱",
            icon: "receipt",
          },
        ],
      },
    ],
    actions: [
      { label: "恢复为新账本", target: "restore-done" },
      { label: "重新选择文件", target: "backup", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "以恢复结果为中心，先说明新增而不是覆盖。",
  },
  {
    id: "backup-progress",
    title: "正在打包这本账",
    group: "数据与设置",
    nav: "mine",
    layout: "state",
    subtitle: "当前文件处理完成后可取消",
    hero: "2 / 3",
    heroLabel: "附件已处理",
    blocks: [
      { kind: "progress", value: "67", caption: "账本与凭证正在汇入完整归档" },
      {
        kind: "notice",
        text: "取消不会改动原账本。加密步骤结束后再检查取消请求。",
      },
    ],
    actions: [
      { label: "查看生成完成状态", target: "backup-done" },
      { label: "取消操作", target: "backup-cancelled", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/BackupPanel.tsx",
      "apps/mobile/src/screens/BackupScreen.tsx",
    ],
    intent: "进度显示具体附件数，解释取消的生效边界。",
  },
  {
    id: "categories",
    title: "用自己的方式分类",
    group: "数据与设置",
    nav: "mine",
    subtitle: "分类名称可修改、排序与归档",
    blocks: [
      {
        kind: "choices",
        items: [
          { label: "支出", selected: true },
          { label: "收入", target: "entry-income" },
        ],
      },
      {
        kind: "list",
        items: [
          {
            label: "餐饮",
            value: "编辑",
            icon: "food",
            target: "category-edit",
          },
          {
            label: "交通",
            value: "编辑",
            icon: "car",
            target: "category-edit",
          },
          {
            label: "购物",
            value: "编辑",
            icon: "bag",
            target: "category-edit",
          },
          {
            label: "订阅",
            value: "编辑",
            icon: "calendar",
            target: "category-edit",
          },
          {
            label: "已归档分类",
            value: "2 项",
            icon: "book",
            target: "category-edit",
          },
        ],
      },
    ],
    actions: [{ label: "添加分类", target: "category-edit" }],
    sources: [
      "apps/web/src/components/settings/CategoriesPanel.tsx",
      "apps/mobile/src/screens/CategoriesScreen.tsx",
    ],
    intent: "列表排序和编辑分离；已有历史分类仍可读。",
  },
  {
    id: "category-edit",
    title: "编辑分类",
    group: "数据与设置",
    nav: "mine",
    subtitle: "餐饮 · 支出分类",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "分类名称", value: "餐饮" },
          { label: "排序位置", value: "第1项", type: "select" },
        ],
      },
      {
        kind: "notice",
        text: "改名会更新显示名称。归档后历史账单保留，新增账单不再优先使用。",
      },
    ],
    actions: [
      { label: "保存分类", target: "categories" },
      { label: "归档分类", target: "archive-confirm", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/CategoriesPanel.tsx",
      "apps/mobile/src/screens/CategoriesScreen.tsx",
    ],
    intent: "改名与归档的影响用短说明表达。",
  },
];
