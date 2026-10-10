import type { Ledger } from "./model.js";
import { ASSET_TYPES, LIABILITY_TYPES } from "./account-model.js";
import { categoryDefinitions } from "./categories.js";
import { saveGoal } from "./debts-goals.js";
import { saveSubscription } from "./subscriptions.js";
/** Shared validation for coupled amounts and references after a batch is applied. */
export function validateFinancialIntegrity(ledger: Ledger): void {
  for (const account of ledger.accounts) {
    const allowed: readonly string[] =
      account.kind === "asset" ? ASSET_TYPES : LIABILITY_TYPES;
    if (!allowed.includes(account.type))
      throw new Error("账户类别与资产/负债性质不匹配。");
  }
  const categories = categoryDefinitions(ledger);
  for (const category of categories)
    if (category.parentId) {
      const parent = categories.find((item) => item.id === category.parentId);
      if (
        !parent ||
        parent.parentId ||
        parent.id === category.id ||
        parent.kind !== category.kind
      )
        throw new Error("分类层级无效，最多支持两级同类型分类。");
    }
  const returns = new Map<string, bigint>();
  for (const record of ledger.records) {
    if (record.isDeleted || record.status !== "confirmed") continue;
    if (record.kind === "退款" && record.detail?.relatedId) {
      const original = ledger.records.find(
        (item) =>
          item.id === record.detail?.relatedId &&
          item.kind === "支出" &&
          item.status === "confirmed" &&
          !item.isDeleted,
      );
      if (!original)
        throw new Error("关联报销或退款仍存在，请先处理回款记录。");
      const total = (returns.get(original.id) ?? 0n) + BigInt(record.amount);
      if (total > BigInt(original.amount))
        throw new Error("退款和报销累计金额不能超过原支出。");
      returns.set(original.id, total);
    }
    if (record.detail && record.detail.origin !== "legacy") {
      for (const movement of record.detail.movements)
        if (
          !ledger.accounts.some((account) => account.id === movement.accountId)
        )
          throw new Error("交易引用的账户不存在。");
    }
  }
  for (const debt of ledger.debts ?? []) {
    const active = ledger.records.filter(
      (record) =>
        !record.isDeleted &&
        record.status === "confirmed" &&
        record.detail?.debtId === debt.id,
    );
    const principal = active.filter((record) =>
      ["lend", "borrow"].includes(record.detail?.type ?? ""),
    );
    const repayments = active.filter((record) =>
      ["repay_receive", "repay_pay"].includes(record.detail?.type ?? ""),
    );
    if (
      principal.length !== 1 ||
      principal[0].detail?.type !==
        (debt.direction === "receivable" ? "lend" : "borrow") ||
      principal[0].detail?.original.minor !== debt.principal ||
      principal[0].detail?.original.currency !== debt.currency
    )
      throw new Error("借贷台账须保留一笔币种与本金一致的关联交易。");
    if (
      repayments.some(
        (record) =>
          record.detail?.original.currency !== debt.currency ||
          record.detail.type !==
            (debt.direction === "receivable" ? "repay_receive" : "repay_pay"),
      ) ||
      repayments.reduce(
        (sum, record) => sum + BigInt(record.detail?.original.minor ?? 0),
        0n,
      ) > BigInt(debt.principal)
    )
      throw new Error("借贷还款币种、方向或剩余本金不一致。");
  }
  for (const goal of ledger.goals ?? []) saveGoal(ledger, goal);
  for (const subscription of ledger.subscriptions ?? []) {
    if (
      subscription.status === "trial" &&
      subscription.trialEnd &&
      subscription.nextDate < subscription.trialEnd
    )
      throw new Error("试用扣费日期不能早于试用结束日期。");
    if (
      !subscription.isArchived &&
      !["paused", "canceled"].includes(subscription.status)
    )
      saveSubscription(ledger, subscription);
  }
}
