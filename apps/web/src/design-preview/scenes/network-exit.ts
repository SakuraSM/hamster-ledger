import type { SceneSpec } from "../model";
export const networkExitScenes: SceneSpec[] = [
  {
    id: "network-delete",
    title: "删除这个联网账本？",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "所有者操作 · 和家人的账",
    blocks: [
      {
        kind: "notice",
        tone: "red",
        heading: "服务端账本数据会删除",
        text: "请先备份并核对影响。此操作与把本机账本归档不同。",
      },
      {
        kind: "fields",
        items: [
          {
            label: "我确认删除联网账本及其服务端数据",
            value: "未勾选",
            type: "toggle",
          },
        ],
      },
    ],
    actions: [
      { label: "确认删除联网账本", target: "books" },
      { label: "先去备份", target: "backup", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkOwnership.tsx",
      "apps/mobile/src/screens/NetworkOwnershipSection.tsx",
    ],
    intent: "删除与归档不混用，明确服务端数据影响并要求显式确认。",
  },
  {
    id: "network-leave",
    title: "退出这本共同的账？",
    group: "状态与反馈",
    nav: "mine",
    layout: "state",
    subtitle: "成员操作 · 和家人的账",
    blocks: [
      {
        kind: "notice",
        tone: "orange",
        text: "退出后不再拥有这本账的访问权限，其他成员仍可使用。",
      },
      {
        kind: "fields",
        items: [
          {
            label: "我确认退出此账本，之后无法访问",
            value: "未勾选",
            type: "toggle",
          },
        ],
      },
    ],
    actions: [
      { label: "确认退出账本", target: "books" },
      { label: "继续保留访问", target: "network", secondary: true },
    ],
    sources: [
      "apps/web/src/components/settings/NetworkOwnership.tsx",
      "apps/mobile/src/screens/NetworkOwnershipSection.tsx",
    ],
    intent: "退出只影响自己的访问，与所有者删除区别清楚。",
  },
];
