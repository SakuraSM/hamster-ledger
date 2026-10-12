import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  confirmPaymentNotification,
  linkPaymentNotification,
  paymentReceiptRecord,
  PAYMENT_RECORD_PREFIX,
  type AdvancedEntryInput,
  type Ledger,
  type PaymentReceipt,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import {
  paymentInbox,
  type PaymentInboxAdapter,
  type PaymentInboxConfig,
  type PaymentInboxStatus,
  type HandledPaymentState,
} from "../platform/payment-inbox";
export interface PaymentInboxController {
  status: PaymentInboxStatus | null;
  receipts: PaymentReceipt[];
  error: string;
  isLoading: boolean;
  isBusy: boolean;
  refresh: () => Promise<void>;
  configure: (config: PaymentInboxConfig) => Promise<boolean>;
  openSettings: () => Promise<void>;
  clear: () => Promise<boolean>;
  discard: (receipt: PaymentReceipt) => Promise<boolean>;
  confirm: (input: {
    receipt: PaymentReceipt;
    entry: AdvancedEntryInput;
    orderId: string;
  }) => Promise<void>;
  link: (input: {
    receipt: PaymentReceipt;
    recordId: string;
  }) => Promise<boolean>;
}
function failure(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "支付消息操作失败，原数据已保留。";
}
export function usePaymentInbox({
  controller,
  adapter = paymentInbox,
}: {
  controller: LedgerController;
  adapter?: PaymentInboxAdapter;
}): PaymentInboxController {
  const [status, setStatus] = useState<PaymentInboxStatus | null>(null),
    [receipts, setReceipts] = useState<PaymentReceipt[]>([]),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [isLoading, setLoading] = useState(true),
    [isBusy, setBusy] = useState(false);
  const latest = useRef(controller),
    mounted = useRef(true),
    locked = useRef(false),
    refreshing = useRef<Promise<void> | null>(null),
    refreshAgain = useRef(false),
    generation = useRef(0);
  latest.current = controller;
  const refresh = useCallback(
    async function refreshInbox(): Promise<void> {
      const version = generation.current;
      if (refreshing.current) {
        refreshAgain.current = true;
        return refreshing.current;
      }
      const pending = (async () => {
        try {
          const [nextStatus, nextReceipts] = await Promise.all([
            adapter.status(),
            adapter.pending(),
          ]);
          if (mounted.current && generation.current === version) {
            setLoadError("");
            setStatus(nextStatus);
            setReceipts(nextReceipts);
          }
        } catch (cause) {
          if (mounted.current && generation.current === version)
            setLoadError(failure(cause));
        } finally {
          if (mounted.current && generation.current === version)
            setLoading(false);
        }
      })();
      refreshing.current = pending;
      try {
        await pending;
      } finally {
        if (refreshing.current === pending) {
          refreshing.current = null;
          if (refreshAgain.current && mounted.current) {
            refreshAgain.current = false;
            void refreshInbox();
          }
        }
      }
    },
    [adapter],
  );
  useEffect(() => {
    generation.current++;
    mounted.current = true;
    void refresh();
    let unsubscribe = () => {};
    try {
      unsubscribe = adapter.subscribe(() => {
        void refresh();
      });
    } catch (cause) {
      setLoadError(failure(cause));
    }
    const state = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });
    return () => {
      mounted.current = false;
      generation.current++;
      refreshing.current = null;
      refreshAgain.current = false;
      unsubscribe();
      state.remove();
    };
  }, [adapter, refresh]);
  async function run(operation: () => Promise<void>): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      await refresh();
      return true;
    } catch (cause) {
      if (mounted.current) setError(failure(cause));
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function target(receipt: PaymentReceipt): LedgerController {
    if (!mounted.current)
      throw new Error("页面或账本已切换，消息已保留，请重新核对。");
    const current = latest.current,
      book = current.books.find((item) => item.id === receipt.bookId);
    if (!book || book.isArchived || book.cloud)
      throw new Error("目标账本已归档、移除或转为联网账本，请先核对原账本。");
    if (current.mode !== receipt.bookId)
      throw new Error("账本已切换，请回到消息绑定的账本再核对。");
    if (current.isLoading || current.isSaving)
      throw new Error("账本正在读写，请稍后重试。");
    return current;
  }
  async function receiptPending(receipt: PaymentReceipt): Promise<void> {
    if (!(await adapter.pending()).some((item) => item.id === receipt.id))
      throw new Error("此消息已处理、过期或被清空，请刷新收件箱。");
  }
  async function acknowledge({
    receipt,
    state,
    recordId,
  }: {
    receipt: PaymentReceipt;
    state: HandledPaymentState;
    recordId?: string;
  }): Promise<void> {
    try {
      await adapter.handled({ id: receipt.id, state, recordId });
    } catch {
      throw new Error(
        "账单已保存，消息状态更新失败。下次核对会复用已保存账单，不会重复入账。",
      );
    }
  }
  async function save({
    receipt,
    entry,
    orderId,
    recordId,
  }: {
    receipt: PaymentReceipt;
    entry?: AdvancedEntryInput;
    orderId?: string;
    recordId?: string;
  }): Promise<void> {
    let current = target(receipt);
    const existing = paymentReceiptRecord({
      ledger: current.ledger,
      receiptId: receipt.id,
    });
    if (existing) {
      await acknowledge({
        receipt,
        state:
          existing.id === PAYMENT_RECORD_PREFIX + receipt.id
            ? "confirmed"
            : "linked",
        recordId: existing.id,
      });
      return;
    }
    const before = current.ledger;
    await receiptPending(receipt);
    current = target(receipt);
    if (current.ledger !== before)
      throw new Error("核对期间账本已更新，请重新核对；草稿已保留。");
    const next: Ledger = recordId
      ? linkPaymentNotification({ ledger: before, receipt, recordId })
      : entry
        ? confirmPaymentNotification({
            ledger: before,
            receipt,
            entry,
            orderId,
          })
        : before;
    if (next === before) throw new Error("缺少有效的核对内容。");
    await current.commit(next, receipt.bookId);
    const saved = paymentReceiptRecord({ ledger: next, receiptId: receipt.id });
    await acknowledge({
      receipt,
      state: recordId ? "linked" : "confirmed",
      recordId: saved?.id,
    });
    current.notify(
      recordId
        ? "已关联已有账单，金额未重复计入。"
        : "支付消息已核对入账，可撤销。",
    );
  }
  return {
    status,
    receipts,
    error: error || loadError,
    isLoading,
    isBusy,
    refresh,
    configure: (config) =>
      run(async () => {
        const book = latest.current.books.find(
          (item) => item.id === config.bookId,
        );
        if (
          config.enabled &&
          (!book || book.id === "demo" || book.isArchived || book.cloud)
        )
          throw new Error("请选择未归档的本机账本。");
        await adapter.configure(config);
      }),
    openSettings: async () => {
      try {
        await adapter.openSettings();
      } catch (cause) {
        setError(failure(cause));
      }
    },
    clear: () => run(() => adapter.clear()),
    discard: (receipt) =>
      run(async () => {
        await adapter.handled({ id: receipt.id, state: "discarded" });
      }),
    confirm: async (input) => {
      let cause: unknown;
      const succeeded = await run(async () => {
        try {
          await save(input);
        } catch (error) {
          cause = error;
          throw error;
        }
      });
      if (!succeeded)
        throw cause instanceof Error
          ? cause
          : new Error("账本正在操作，请稍后重试。");
    },
    link: (input) => run(() => save(input)),
  };
}
