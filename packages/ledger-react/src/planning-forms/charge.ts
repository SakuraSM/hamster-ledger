import { paySubscription, type Subscription } from "@hamster-ledger/core";
import { value, type FinanceForm } from "./model.js";
export function subscriptionChargeForm(
  subscription: Subscription,
): FinanceForm {
  return {
    title: `记录 ${subscription.name} 本期扣费`,
    fxDateField: "date",
    initial: {
      currency: subscription.currency,
      date: subscription.nextDate,
      rate: "",
      rateDate: subscription.nextDate,
    },
    fields: [
      {
        key: "rate",
        label: `1 ${subscription.currency} 折合人民币`,
        type: "money",
        visible: () => subscription.currency !== "CNY",
      },
      {
        key: "rateDate",
        label: "实际汇率日期",
        type: "date",
        visible: () => subscription.currency !== "CNY",
      },
    ],
    submit(ledger, values) {
      return paySubscription({
        ledger,
        id: subscription.id,
        rate: {
          currency: subscription.currency,
          rate: subscription.currency === "CNY" ? "1" : value(values, "rate"),
          date:
            subscription.currency === "CNY"
              ? subscription.nextDate
              : value(values, "rateDate"),
          source:
            values.rateSource === "frankfurter" ? "frankfurter" : "manual",
        },
      });
    },
  };
}
