const DECIMAL_BASE = 10;
import { useState } from "react";
import {
  addMinor,
  CURRENCY_DIGITS,
  dateTimeSchema,
  parseMinor,
  projectAccountBalance,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";

export interface BalanceCalibrationController {
  amount: string;
  at: string;
  note: string;
  error: string;
  isSaving: boolean;
  preview: {
    expected: number | null;
    actual: number;
    difference: number | null;
  } | null;
  setAmount: (value: string) => void;
  setAt: (value: string) => void;
  setNote: (value: string) => void;
  save: () => Promise<void>;
}
export function useBalanceCalibration(input: {
  ledger: Ledger;
  account: AssetAccount;
  initialAt: string;
  now: () => string;
  onSave: (value: { account: AssetAccount; note: string }) => Promise<void>;
  onClose: () => void;
}): BalanceCalibrationController {
  const currentAccount = input.ledger.accounts.find(
    (account) => account.id === input.account.id,
  );
  const currency = input.account.currency ?? "CNY";
  const [at, setAt] = useState(input.initialAt);
  const [amount, setAmount] = useState(() =>
    String(
      projectAccountBalance({
        ledger: input.ledger,
        account: input.account,
        through: input.initialAt,
      }).balance /
        DECIMAL_BASE ** CURRENCY_DIGITS[currency],
    ),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setSaving] = useState(false);
  let preview: BalanceCalibrationController["preview"] = null;
  try {
    dateTimeSchema.parse(at);
    const actual = parseMinor({ value: amount, currency });
    const projection = projectAccountBalance({
      ledger: input.ledger,
      account: currentAccount ?? input.account,
      through: at,
    });
    preview = {
      actual,
      expected: projection.baseline ? projection.balance : null,
      difference: projection.baseline
        ? addMinor(actual, -projection.balance)
        : null,
    };
  } catch {
    // Incomplete form input has no meaningful preview; save reports its validation error.
  }
  async function save(): Promise<void> {
    if (isSaving) return;
    setSaving(true);
    setError("");
    try {
      if (!currentAccount)
        throw new Error("账户已不存在，请重新打开资产管理。");
      if (!dateTimeSchema.safeParse(at).success)
        throw new Error("请选择有效的余额确认时间。");
      if (at > input.now()) throw new Error("余额确认时间不能晚于当前时间。");
      const balance = parseMinor({ value: amount, currency });
      await input.onSave({
        account: { ...currentAccount, openingBalance: balance, balanceAt: at },
        note: note.trim() || "核对实际余额",
      });
      input.onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "余额校准失败。");
    } finally {
      setSaving(false);
    }
  }
  return {
    amount,
    at,
    note,
    error,
    isSaving,
    preview,
    setAmount,
    setAt,
    setNote,
    save,
  };
}
