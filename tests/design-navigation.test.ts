import { expect, it } from "vitest";
import { getScene } from "../apps/web/src/design-preview/catalog";
import { ASSET_ACCOUNTS } from "../apps/web/src/design-preview/asset-fixture";
import { planPreviewNavigation } from "../apps/web/src/design-preview/navigation";

it("opens the reimbursement example from both reimbursement entries", () => {
  for (const [id, label] of [
    ["advanced-entry", "报销"],
    ["extended-reports", "查看回款关联"],
  ]) {
    const item = getScene(id!)
      .blocks.flatMap((block) => block.items ?? [])
      .find((row) => row.label === label);
    expect(item?.target).toBe("reimburse-entry");
  }
});

it("keeps wallet accounts out of the cash ledger example", () => {
  for (const account of ASSET_ACCOUNTS.filter(
    (item) => item.type === "网络钱包",
  ))
    expect(account.target).toBe("wallet-accounts");
});

it("keeps the original reimbursable purchase in its own example", () => {
  const item = getScene("extended-reports")
    .blocks.flatMap((block) => block.items ?? [])
    .find((row) => row.label === "办公用品");
  expect(item?.target).toBe("reimburse-entry");
});

it("confirms category and book archive within their own scope", () => {
  for (const [source, destination, name] of [
    ["category-edit", "categories", "餐饮分类"],
    ["book-edit", "books", "生活账"],
  ]) {
    const plan = planPreviewNavigation({
      sceneId: source!,
      target: "archive-confirm",
    });
    expect(plan.kind).toBe("confirm");
    expect(plan.target).toBe(destination);
    expect(plan.message).toContain(name);
    expect(plan.message).not.toContain("现金");
  }
});

it("does not open another account's history, editor, balance or records", () => {
  for (const [source, targets] of Object.entries({
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
    "missing-baseline": ["account-edit"],
  }))
    for (const target of targets) {
      const plan = planPreviewNavigation({ sceneId: source, target });
      expect(plan.kind, `${source} -> ${target}`).toBe("static");
      expect(plan.message).toContain("静态示意");
    }
});

it("keeps the taxi distinct from the fixed lunch detail", () => {
  for (const source of ["account-detail", "account-records", "calendar"])
    expect(
      planPreviewNavigation({
        sceneId: source,
        target: "record",
        subject: "打车",
      }).kind,
    ).toBe("static");
  expect(
    planPreviewNavigation({
      sceneId: "account-detail",
      target: "record",
      subject: "午餐",
    }).kind,
  ).toBe("navigate");
});

it("preserves the cash calibration and credit repayment navigation", () => {
  for (const [source, target] of [
    ["account-detail", "calibration"],
    ["calibration", "calibration-difference"],
    ["calibration-difference", "calibration-done"],
    ["account-edit", "archive-confirm"],
    ["liability-detail", "card-repayment"],
  ])
    expect(
      planPreviewNavigation({ sceneId: source!, target: target! }),
    ).toEqual({
      kind: "navigate",
      target,
    });
});
