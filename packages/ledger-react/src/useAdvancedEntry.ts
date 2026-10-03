import { useRef, useState } from "react";
import {
  saveAdvancedEntry,
  type BillRecord,
  type Currency,
  type Ledger,
} from "@hamster-ledger/core";
import {
  buildAdvancedEntry,
  initialEntryDraft,
  type EntryDraft,
} from "./advanced-entry-form.js";
import { requestExchangeRate, type RateQuote } from "./useExchangeRates.js";
import type { NetworkClient } from "./network-model.js";
export interface AdvancedEntryController {
  draft: EntryDraft;
  currency: Currency;
  destinationCurrency: Currency;
  quote: RateQuote | null;
  error: string;
  isBusy: boolean;
  needsRateConfirmation: boolean;
  change: <Key extends keyof EntryDraft>(
    key: Key,
    value: EntryDraft[Key],
  ) => void;
  fetchRate: () => Promise<void>;
  confirmRate: () => void;
  save: () => Promise<void>;
}
export function useAdvancedEntry(input: {
  ledger: Ledger;
  record?: BillRecord;
  initialDraft?: Partial<EntryDraft>;
  now: string;
  newId: () => string;
  client: NetworkClient;
  onSave: (ledger: Ledger, date: string) => Promise<void>;
  onClose: () => void;
}): AdvancedEntryController {
  const [baseline] = useState(input.record);
  const [draft, setDraft] = useState(() => ({
    ...initialEntryDraft(input.ledger, input.record, input.now, input.newId()),
    ...input.initialDraft,
  }));
  const [error, setError] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [quote, setQuote] = useState<RateQuote | null>(null);
  const [needsRateConfirmation, setRateConfirmation] = useState(false);
  const lock = useRef(false);
  const current = useRef(draft);
  current.current = draft;
  const currency =
    input.ledger.accounts.find((account) => account.id === draft.accountId)
      ?.currency ?? "CNY";
  const destinationCurrency =
    input.ledger.accounts.find((account) => account.id === draft.destinationId)
      ?.currency ?? "CNY";
  function change<Key extends keyof EntryDraft>(
    key: Key,
    value: EntryDraft[Key],
  ): void {
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      if (key === "accountId") {
        const nextCurrency =
          input.ledger.accounts.find((account) => account.id === value)
            ?.currency ?? "CNY";
        next.rate = nextCurrency === "CNY" ? "1" : "";
        next.rateDate = next.date.slice(0, 10);
        next.rateSource = "manual";
      }
      if (
        key === "date" &&
        previous.date.slice(0, 10) !== next.date.slice(0, 10)
      ) {
        next.rate = currency === "CNY" ? "1" : "";
        next.rateDate = next.date.slice(0, 10);
        next.rateSource = "manual";
      }
      if (key === "rate" || key === "rateDate") next.rateSource = "manual";
      return next;
    });
    if (["accountId", "rate", "rateDate", "date"].includes(key)) {
      setQuote(null);
      setRateConfirmation(false);
    }
  }
  async function fetchRate(): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const requested = draft;
    try {
      const rate = await requestExchangeRate(
        input.client,
        currency,
        requested.date.slice(0, 10),
      );
      if (current.current !== requested) return;
      setDraft((previous) => ({
        ...previous,
        rate: rate.rate,
        rateDate: rate.date,
        rateSource: rate.source,
      }));
      setQuote(rate);
      setRateConfirmation(Boolean(rate.needsConfirmation));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "查询汇率失败，请手填。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (needsRateConfirmation)
        throw new Error("请先确认缓存参考汇率，或手动修正。");
      await input.onSave(
        saveAdvancedEntry(
          input.ledger,
          buildAdvancedEntry(input.ledger, draft, baseline),
        ),
        draft.date,
      );
      input.onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存失败，草稿已保留。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    draft,
    currency,
    destinationCurrency,
    quote,
    error,
    isBusy,
    needsRateConfirmation,
    change,
    fetchRate,
    confirmRate: () => setRateConfirmation(false),
    save,
  };
}
