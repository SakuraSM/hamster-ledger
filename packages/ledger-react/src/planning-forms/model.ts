import type { Ledger } from "@hamster-ledger/core";
export type FormValues = Record<string, string | boolean>;
export interface FinanceField {
  key: string;
  label: string;
  type: "text" | "money" | "integer" | "date" | "choice" | "toggle";
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  visible?: (values: FormValues) => boolean;
}
export interface FinanceForm {
  title: string;
  fields: FinanceField[];
  initial: FormValues;
  submit: (ledger: Ledger, values: FormValues) => Ledger;
  fxDateField?: string;
}
export const value = (values: FormValues, key: string): string =>
  String(values[key] ?? "");
export const accountOptions = (
  ledger: Ledger,
): Array<{ value: string; label: string }> => [
  { value: "", label: "不关联" },
  ...ledger.accounts
    .filter((account) => !account.isArchived)
    .map((account) => ({
      value: account.id,
      label: `${account.name} · ${account.currency ?? "CNY"}`,
    })),
];
