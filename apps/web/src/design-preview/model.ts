import type { ReactNode } from "react";
export const DESIGN_DATE = "2026-11-06";
export const MOBILE_SIZE = { width: 390, height: 844 } as const;
export const DESKTOP_SIZE = { width: 1440, height: 1024 } as const;

export const LOGO = "/assets/hamster-logo.png";
export type DesignMode = "mobile" | "desktop";
export type IconName =
  | "receipt"
  | "wallet"
  | "calendar"
  | "coffee"
  | "food"
  | "car"
  | "bag"
  | "sparkle"
  | "download"
  | "upload"
  | "lock"
  | "globe"
  | "users"
  | "chart"
  | "settings"
  | "bell"
  | "book"
  | "tag"
  | "image"
  | "check"
  | "arrow"
  | "chevron"
  | "plus"
  | "search"
  | "back"
  | "dots"
  | "shield"
  | "clock"
  | "trash"
  | "warning"
  | "target"
  | "eye"
  | "share"
  | "close"
  | "refresh";
export type BlockKind =
  | "list"
  | "fields"
  | "metrics"
  | "chart"
  | "calendar"
  | "notice"
  | "image"
  | "upload"
  | "comparison"
  | "choices"
  | "progress"
  | "keypad"
  | "mapping"
  | "themes";
export interface VisualItem {
  label: string;
  value?: string;
  note?: string;
  icon?: IconName;
  tone?: "orange" | "olive" | "red";
  selected?: boolean;
  target?: string;
  type?: "text" | "password" | "select" | "toggle";
}
export interface VisualBlock {
  kind: BlockKind;
  heading?: string;
  text?: string;
  items?: VisualItem[];
  value?: string;
  caption?: string;
  tone?: "orange" | "olive" | "red";
}
export interface DesignAction {
  label: string;
  target: string;
  secondary?: boolean;
}
export interface SceneSpec {
  id: string;
  title: string;
  group: string;
  nav: "inbox" | "ledger" | "mine";
  layout?:
    | "receipt"
    | "overview"
    | "standard"
    | "auth"
    | "state"
    | "assets"
    | "account";
  subtitle: string;
  counter?: string;
  hero?: string;
  heroLabel?: string;
  badge?: string;
  blocks: VisualBlock[];
  actions: DesignAction[];
  sources: string[];
  intent: string;
  mobileOnly?: boolean;
  webOnly?: boolean;
  night?: boolean;
}
export interface SceneBodyProps {
  scene: SceneSpec;
  mode: DesignMode;
  onNavigate: (id: string) => void;
}
export interface BlockProps {
  block: VisualBlock;
  onNavigate: (id: string) => void;
}
export interface ChildrenProps {
  children: ReactNode;
}
