import type { SceneSpec } from "../model";
export const captureScenes2: SceneSpec[] = [
  {
    id: "attachment",
    title: "原始凭证",
    group: "记录与核对",
    nav: "ledger",
    subtitle: "示例凭证 · 1 / 1",
    blocks: [
      {
        kind: "image",
        heading: "街角咖啡",
        caption: "原始金额 ¥18.00 · 2026-11-06",
      },
      {
        kind: "list",
        items: [
          {
            label: "关联记录",
            value: "未入账",
            note: "街角咖啡 · ¥18.00",
            icon: "receipt",
            target: "inbox",
          },
          {
            label: "文件信息",
            value: "PNG",
            note: "凭证随完整归档一起备份",
            icon: "image",
          },
        ],
      },
    ],
    actions: [{ label: "返回核对", target: "inbox" }],
    sources: [
      "apps/web/src/components/ai/DraftAttachments.tsx",
      "apps/mobile/src/screens/DraftAttachments.tsx",
    ],
    intent: "原图优先，关联状态与文件信息放在图像之后。",
  },
  {
    id: "metadata",
    title: "分类与账户",
    group: "记录与核对",
    nav: "inbox",
    subtitle: "修改信息不会替你确认入账",
    hero: "¥24.00",
    heroLabel: "待确认 · 打车",
    blocks: [
      {
        kind: "fields",
        items: [
          { label: "收支类型", value: "支出", type: "select" },
          { label: "分类", value: "交通", type: "select" },
          { label: "收付款账户", value: "现金", type: "select" },
          { label: "备注", value: "下班出行" },
        ],
      },
    ],
    actions: [{ label: "保存信息", target: "unpaired" }],
    sources: [
      "apps/mobile/src/screens/RecordMetadataEditor.tsx",
      "apps/web/src/components/RecordAccountFields.tsx",
    ],
    intent: "待确认流水的编辑和入账是两个独立动作。",
  },
];
