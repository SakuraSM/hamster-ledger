import {
  goalSchema,
  saveGoal,
  parseMinor,
  type Ledger,
  type SavingsGoal,
} from "@hamster-ledger/core";
import { accountOptions, value, type FinanceForm } from "./model.js";
export function goalForm(
  ledger: Ledger,
  id: string,
  existing?: SavingsGoal,
): FinanceForm {
  return {
    title: existing ? "编辑储蓄目标" : "新建储蓄目标",
    initial: {
      name: existing?.name ?? "",
      target: existing ? String(existing.target / 100) : "",
      dueDate: existing?.dueDate ?? "",
      accountId: existing?.accountId ?? "",
    },
    fields: [
      { key: "name", label: "目标名称", type: "text" },
      { key: "target", label: "目标金额（人民币元）", type: "money" },
      { key: "dueDate", label: "目标期限（可选）", type: "date" },
      {
        key: "accountId",
        label: "关联账户",
        type: "choice",
        options: accountOptions(ledger),
      },
    ],
    submit(current, values) {
      if (
        existing &&
        JSON.stringify(
          current.goals?.find((item) => item.id === existing.id),
        ) !== JSON.stringify(existing)
      )
        throw new Error("目标已更新，请重新打开核对。");
      return saveGoal(
        current,
        goalSchema.parse({
          ...existing,
          id: existing?.id ?? id,
          name: value(values, "name"),
          target: parseMinor({
            value: value(values, "target"),
            currency: "CNY",
          }),
          dueDate: values.dueDate || undefined,
          accountId: values.accountId || null,
        }),
      );
    },
  };
}
export function allocationForm(
  ledger: Ledger,
  goal: SavingsGoal,
  id: string,
  today: string,
): FinanceForm {
  return {
    title: "分配目标资金",
    initial: { amount: "", date: today, recordId: "" },
    fields: [
      {
        key: "amount",
        label: "分配金额（人民币元，取出填负数）",
        type: "money",
      },
      { key: "date", label: "分配日期", type: "date" },
      {
        key: "recordId",
        label: "关联实际转账（可选）",
        type: "choice",
        options: [
          { value: "", label: "仅调整目标分配，不产生流水" },
          ...ledger.records
            .filter(
              (record) =>
                !record.isDeleted &&
                record.status === "confirmed" &&
                record.kind === "转账",
            )
            .map((record) => ({
              value: record.id,
              label: `${record.date.slice(0, 10)} · ${record.merchant}`,
            })),
        ],
      },
    ],
    submit(current, values) {
      const latest = current.goals?.find((item) => item.id === goal.id);
      if (!latest) throw new Error("目标已不存在。");
      return saveGoal(current, {
        ...latest,
        allocations: [
          ...latest.allocations,
          {
            id,
            amount: parseMinor({
              value: value(values, "amount"),
              currency: "CNY",
            }),
            date: value(values, "date"),
            recordId: value(values, "recordId") || undefined,
          },
        ],
      });
    },
  };
}
