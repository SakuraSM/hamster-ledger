export const DEFAULT_MONTH = "2026-09";
export type ToolDestination = {
  section: "books" | "account" | null;
  serial: number;
};
export type PageId =
  | "inbox"
  | "overview"
  | "transactions"
  | "import"
  | "review"
  | "assets"
  | "calendar"
  | "budgets"
  | "reports"
  | "recurring"
  | "tools";
