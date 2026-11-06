export interface PreviewNavigation {
  kind: "navigate" | "confirm" | "static";
  target: string;
  message?: string;
}

const STATIC_ACCOUNT_BRANCHES: Record<string, readonly string[]> = {
  "bank-detail": [
    "record",
    "account-records",
    "account-history",
    "account-edit",
    "calibration",
  ],
  "liability-detail": ["account-records", "account-history"],
  "wallet-accounts": ["account-records", "account-edit"],
  "foreign-account": ["account-history"],
  "investment-account": ["account-history", "calibration"],
  "credit-prepaid": ["account-history", "calibration"],
  "missing-baseline": ["account-edit", "account-history"],
  "payment-recovery": ["record"],
};

export function planPreviewNavigation({
  sceneId,
  target,
  subject,
}: {
  sceneId: string;
  target: string;
  subject?: string;
}): PreviewNavigation {
  if (target === "archive-confirm" && sceneId === "category-edit")
    return {
      kind: "confirm",
      target: "categories",
      message:
        "归档餐饮分类？历史账单会保留，新账单不再优先使用该分类。本次仅演示确认，不修改真实数据。",
    };
  if (target === "archive-confirm" && sceneId === "book-edit")
    return {
      kind: "confirm",
      target: "books",
      message:
        "归档生活账？账单会保留，可从归档列表恢复。本次仅演示确认，不修改真实数据。",
    };
  if (
    STATIC_ACCOUNT_BRANCHES[sceneId]?.includes(target) ||
    (target === "record" && subject && subject !== "午餐")
  )
    return {
      kind: "static",
      target,
      message:
        "此入口为静态示意。该账户或账单的后续稿件未单独展开，因此保留当前对象，不跳到其他账户或账单。可从图集索引查看独立示例。",
    };
  return { kind: "navigate", target };
}
