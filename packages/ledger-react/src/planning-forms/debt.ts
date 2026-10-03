import {
  CURRENCIES,
  createDebt,
  settleDebt,
  debtSchema,
  parseMinor,
  type Ledger,
  type Debt,
  type Currency,
} from "@hamster-ledger/core";
import {
  accountOptions,
  value,
  type FinanceField,
  type FinanceForm,
  type FormValues,
} from "./model.js";
const exchangeFields: FinanceField[] = [
  {
    key: "rate",
    label: "1 原币单位折合人民币",
    type: "money",
    visible: (values) => values.currency !== "CNY",
  },
  {
    key: "rateDate",
    label: "实际汇率日期",
    type: "date",
    visible: (values) => values.currency !== "CNY",
  },
];
function exchange(values: FormValues, currency: Currency, date: string) {
  return {
    currency,
    rate: currency === "CNY" ? "1" : value(values, "rate"),
    date: currency === "CNY" ? date : value(values, "rateDate"),
    source:
      values.rateSource === "frankfurter"
        ? ("frankfurter" as const)
        : ("manual" as const),
  };
}
export function debtForm(
  ledger: Ledger,
  id: string,
  today: string,
): FinanceForm {
  return {
    title: "新增借贷",
    fxDateField: "date",
    initial: {
      name: "",
      direction: "receivable",
      currency: "CNY",
      amount: "",
      accountId: "",
      counterAccountId: "",
      date: today,
      dueDate: "",
      rate: "",
      rateDate: today,
    },
    fields: [
      { key: "name", label: "对方名称 / 借贷说明", type: "text" },
      {
        key: "direction",
        label: "方向",
        type: "choice",
        options: [
          { value: "receivable", label: "我借出（应收）" },
          { value: "payable", label: "我借入（应付）" },
        ],
      },
      {
        key: "currency",
        label: "本金币种",
        type: "choice",
        options: CURRENCIES.map((value) => ({ value, label: value })),
      },
      { key: "amount", label: "借贷本金（原币）", type: "money" },
      {
        key: "accountId",
        label: "收付款账户",
        type: "choice",
        options: accountOptions(ledger),
      },
      {
        key: "counterAccountId",
        label: "应收 / 应付账户",
        type: "choice",
        options: [
          { value: "", label: "请选择对应类型账户" },
          ...ledger.accounts
            .filter(
              (account) =>
                !account.isArchived &&
                ["应收款", "应付款"].includes(account.type),
            )
            .map((account) => ({ value: account.id, label: account.name })),
        ],
      },
      { key: "date", label: "借贷日期", type: "date" },
      { key: "dueDate", label: "到期日期（可选）", type: "date" },
      ...exchangeFields,
    ],
    submit(current, values) {
      const currency = debtSchema.shape.currency.parse(values.currency);
      return createDebt({
        ledger: current,
        debt: debtSchema.parse({
          id,
          name: value(values, "name"),
          direction: values.direction,
          currency,
          principal: parseMinor({ value: value(values, "amount"), currency }),
          accountId: values.accountId,
          counterAccountId: values.counterAccountId,
          openedOn: values.date,
          dueDate: values.dueDate || undefined,
        }),
        rate: exchange(values, currency, value(values, "date")),
      });
    },
  };
}
export function repaymentForm(
  debt: Debt,
  id: string,
  today: string,
): FinanceForm {
  return {
    title: debt.direction === "receivable" ? "收回借款" : "偿还借款",
    fxDateField: "date",
    initial: {
      amount: "",
      interest: "0",
      date: today,
      currency: debt.currency,
      rate: "",
      rateDate: today,
    },
    fields: [
      { key: "amount", label: `本次本金（${debt.currency}）`, type: "money" },
      {
        key: "interest",
        label: `另收 / 另付利息（${debt.currency}）`,
        type: "money",
      },
      { key: "date", label: "还款日期", type: "date" },
      ...exchangeFields,
    ],
    submit(current, values) {
      return settleDebt({
        ledger: current,
        debtId: debt.id,
        id,
        amount: parseMinor({
          value: value(values, "amount"),
          currency: debt.currency,
        }),
        interest: parseMinor({
          value: value(values, "interest"),
          currency: debt.currency,
        }),
        date: value(values, "date"),
        rate: exchange(values, debt.currency, value(values, "date")),
      });
    },
  };
}
