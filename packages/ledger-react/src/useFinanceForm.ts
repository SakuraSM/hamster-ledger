import { useRef, useState } from "react";
import type { Currency, Ledger } from "@hamster-ledger/core";
import { requestExchangeRate } from "./useExchangeRates.js";
import type { NetworkClient } from "./network-model.js";
import type { FinanceForm, FormValues } from "./planning-forms/model.js";
export interface FinanceFormController {
  values: FormValues;
  error: string;
  isBusy: boolean;
  change: (key: string, value: string | boolean) => void;
  save: () => Promise<void>;
  fetchRate: () => Promise<void>;
}
export function useFinanceForm(input: {
  form: FinanceForm;
  ledger: Ledger;
  client: NetworkClient;
  onSave: (ledger: Ledger) => Promise<void>;
  onClose: () => void;
}): FinanceFormController {
  const [values, setValues] = useState(input.form.initial),
    [error, setError] = useState(""),
    [isBusy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = useRef(values);
  current.current = values;
  function change(key: string, value: string | boolean): void {
    setValues((previous) => ({
      ...previous,
      [key]: value,
      ...(key === input.form.fxDateField ||
      ["rate", "rateDate", "currency"].includes(key)
        ? {
            rateSource: "manual",
            ...(key === "currency" || key === input.form.fxDateField
              ? { rate: "", rateDate: "" }
              : {}),
          }
        : {}),
    }));
  }
  async function save(): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await input.onSave(input.form.submit(input.ledger, values));
      input.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存失败，已保留当前表单。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function fetchRate(): Promise<void> {
    if (lock.current || !input.form.fxDateField) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const requested = values;
    const date = String(values[input.form.fxDateField]),
      currency = String(values.currency) as Currency;
    try {
      const rate = await requestExchangeRate(input.client, currency, date);
      if (
        current.current !== requested ||
        current.current.currency !== currency ||
        current.current[input.form.fxDateField] !== date
      )
        return;
      if (rate.needsConfirmation)
        throw new Error(
          `服务暂不可用。缓存 ${rate.date} 的参考值为 ${rate.rate}，请核对后手动填写。`,
        );
      setValues((previous) => ({
        ...previous,
        rate: rate.rate,
        rateDate: rate.date,
        rateSource: rate.source,
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "参考汇率不可用，请手填。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { values, error, isBusy, change, save, fetchRate };
}
