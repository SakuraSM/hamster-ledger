import { addMinor } from "./currency.js";
import type { Ledger } from "./model.js";
import {
  debtSchema,
  goalSchema,
  type Debt,
  type SavingsGoal,
} from "./finance-model.js";
import type { ExchangeRate } from "./currency.js";
import { saveAdvancedEntry } from "./advanced-entries.js";

export function debtRemaining(ledger: Ledger, debt: Debt): number {
  const paid = ledger.records
    .filter(
      (record) =>
        !record.isDeleted &&
        record.status === "confirmed" &&
        record.detail?.debtId === debt.id &&
        ["repay_pay", "repay_receive"].includes(record.detail.type),
    )
    .reduce(
      (sum, record) => addMinor(sum, record.detail?.original.minor ?? 0),
      0,
    );
  return debt.principal - paid;
}
export function createDebt(input: {
  ledger: Ledger;
  debt: Debt;
  rate: ExchangeRate;
}): Ledger {
  const debt = debtSchema.parse(input.debt);
  if (input.ledger.debts?.some((item) => item.id === debt.id))
    throw new Error("借贷记录已存在。");
  if (input.rate.currency !== debt.currency)
    throw new Error("汇率币种不匹配。");
  const counter = input.ledger.accounts.find(
    (account) => account.id === debt.counterAccountId,
  );
  if (
    !counter ||
    counter.type !== (debt.direction === "receivable" ? "应收款" : "应付款")
  )
    throw new Error("借贷需关联相应的应收或应付账户。");
  const receiving = debt.direction === "receivable";
  const next = saveAdvancedEntry(input.ledger, {
    id: `debt:${debt.id}:principal`,
    date: debt.openedOn + " 12:00:00",
    merchant: debt.name,
    category: "其他",
    accountId: receiving ? debt.accountId : debt.counterAccountId,
    transferToAccountId: receiving ? debt.counterAccountId : debt.accountId,
    detail: {
      type: receiving ? "lend" : "borrow",
      original: { ...input.rate, minor: debt.principal },
      debtId: debt.id,
      origin: "manual",
      attachmentIds: [],
      splits: [],
      movements: [],
    },
  });
  return { ...next, debts: [...(next.debts ?? []), debt] };
}
export function settleDebt(input: {
  ledger: Ledger;
  debtId: string;
  amount: number;
  rate: ExchangeRate;
  date: string;
  id: string;
  interest?: number;
}): Ledger {
  const debt = input.ledger.debts?.find(
    (item) => item.id === input.debtId && !item.isArchived,
  );
  if (!debt) throw new Error("借贷台账不存在或已归档。");
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > debtRemaining(input.ledger, debt)
  )
    throw new Error("还款金额须大于零且不超过剩余本金。");
  if (input.rate.currency !== debt.currency)
    throw new Error("还款币种不匹配。");
  if (
    input.interest !== undefined &&
    (!Number.isSafeInteger(input.interest) || input.interest < 0)
  )
    throw new Error("利息金额须为非负整数。");
  if (input.ledger.records.some((record) => record.id === input.id))
    throw new Error("此笔还款已记录。");
  if (input.date < debt.openedOn)
    throw new Error("还款日期不能早于借贷开始日期。");
  const receiving = debt.direction === "receivable";
  let next = saveAdvancedEntry(input.ledger, {
    id: input.id,
    date: input.date + " 12:00:00",
    merchant: debt.name,
    category: "其他",
    accountId: receiving ? debt.counterAccountId : debt.accountId,
    transferToAccountId: receiving ? debt.accountId : debt.counterAccountId,
    detail: {
      type: receiving ? "repay_receive" : "repay_pay",
      original: { ...input.rate, minor: input.amount },
      debtId: debt.id,
      origin: "manual",
      attachmentIds: [],
      splits: [],
      movements: [],
    },
  });
  if (input.interest && input.interest > 0)
    next = saveAdvancedEntry(next, {
      id: input.id + ":interest",
      date: input.date + " 12:00:00",
      merchant: debt.name + "利息",
      category: "其他",
      accountId: debt.accountId,
      detail: {
        type: receiving ? "interest" : "fee",
        original: { ...input.rate, minor: input.interest },
        debtId: debt.id,
        origin: "manual",
        attachmentIds: [],
        splits: [],
        movements: [],
      },
    });
  return next;
}
export function saveGoal(ledger: Ledger, input: SavingsGoal): Ledger {
  const goal = goalSchema.parse(input);
  if (
    goal.accountId &&
    !ledger.accounts.some((account) => account.id === goal.accountId)
  )
    throw new Error("目标关联账户不存在。");
  if (goal.allocations.reduce((sum, item) => addMinor(sum, item.amount), 0) < 0)
    throw new Error("取出金额不能超过已分配金额。");
  if (
    new Set(goal.allocations.map((item) => item.id)).size !==
    goal.allocations.length
  )
    throw new Error("目标资金记录重复。");
  for (const allocation of goal.allocations)
    if (
      allocation.recordId &&
      !ledger.records.some(
        (record) =>
          record.id === allocation.recordId &&
          !record.isDeleted &&
          record.status === "confirmed" &&
          record.kind === "转账",
      )
    )
      throw new Error("只能关联已确认的实际转账。");
  return {
    ...ledger,
    goals: [
      ...(ledger.goals ?? []).filter((item) => item.id !== goal.id),
      goal,
    ],
  };
}
