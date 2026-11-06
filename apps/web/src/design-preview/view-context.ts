import type { SceneSpec } from "./model";
const BOOK_NAMES: Record<string, string> = {
  sync: "旅行小账",
  "sync-conflict": "旅行小账",
  network: "和家人的账",
  invite: "和家人的账",
  "invite-ready": "和家人的账",
  "join-book": "和家人的账",
  members: "和家人的账",
  "member-role": "和家人的账",
  "member-remove": "和家人的账",
  ownership: "和家人的账",
  activity: "和家人的账",
  "open-tokens": "和家人的账",
  "token-created": "和家人的账",
  "network-delete": "和家人的账",
  "network-leave": "和家人的账",
  readonly: "和家人的账",
  "ai-policy": "和家人的账",
  "foreign-account": "外币示例",
  rates: "外币示例",
  "investment-account": "投资示例",
  "extended-reports": "报销示例",
  "reimburse-entry": "报销示例",
  "credit-prepaid": "预存余额示例",
};
const EXTRA_AUTH_SCENES = new Set(["registration-closed", "onboarding"]);
export function isAuthScene(scene: SceneSpec): boolean {
  return scene.layout === "auth" || EXTRA_AUTH_SCENES.has(scene.id);
}
export function bookName(scene: SceneSpec): string {
  return BOOK_NAMES[scene.id] ?? "生活账";
}
export function storageLabel(scene: SceneSpec): string {
  const name = bookName(scene);
  if (name === "和家人的账") return "联网账本 · 离线仅可查看缓存";
  if (name === "旅行小账") return "个人同步 · 本机可离线编辑";
  return "本机账本 · 可离线编辑";
}
