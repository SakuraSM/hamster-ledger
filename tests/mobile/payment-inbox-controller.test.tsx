// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type {
  AdvancedEntryInput,
  Ledger,
  PaymentReceipt,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type {
  PaymentInboxAdapter,
  PaymentInboxConfig,
  PaymentInboxStatus,
  HandledPaymentState,
} from "../../apps/mobile/src/platform/payment-inbox";
import { usePaymentInbox } from "../../apps/mobile/src/hooks/usePaymentInbox";
const subscriptions = vi.hoisted(() => ({
  native: new Set<() => void>(),
  state: new Set<(state: string) => void>(),
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_name: string, listener: (state: string) => void) => {
      subscriptions.state.add(listener);
      return { remove: () => subscriptions.state.delete(listener) };
    },
  },
}));
vi.mock("../../apps/mobile/src/platform/payment-inbox", () => ({
  paymentInbox: {},
}));
afterEach(() => {
  cleanup();
  subscriptions.native.clear();
  subscriptions.state.clear();
});
const receipt: PaymentReceipt = {
  id: "a".repeat(64),
  source: "微信支付",
  bookId: "personal",
  title: "微信支付",
  text: "支付成功，实付12.34元",
  postedAt: 1791763200000,
  capturedAt: 1791763200001,
  isTruncated: false,
};
const seed: Ledger = {
  version: 2,
  baseCurrency: "CNY",
  records: [],
  reviews: [],
  rules: {},
  files: [],
  accounts: [
    {
      id: "cash",
      name: "QA现金",
      kind: "asset",
      type: "现金",
      aliases: [],
      isArchived: false,
      checkpoints: [],
      openingBalance: 100000,
      balanceAt: "2026-10-01 00:00:00",
      currency: "CNY",
    },
  ],
};
const entry: AdvancedEntryInput = {
  id: "edited",
  date: "2026-10-12 12:00:00",
  merchant: "QA小店",
  category: "餐饮",
  accountId: "cash",
  detail: {
    type: "expense",
    origin: "manual",
    original: {
      minor: 1234,
      currency: "CNY",
      rate: "1",
      date: "2026-10-12",
      source: "manual",
    },
  },
};
function fixture(): {
  controller: LedgerController;
  adapter: PaymentInboxAdapter;
} {
  const controller: LedgerController = {
    books: [
      { id: "demo", name: "示例账本" },
      { id: "personal", name: "QA账本" },
    ],
    ledger: seed,
    personalLedger: seed,
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: vi.fn(),
    commit: vi.fn(async (next: Ledger) => {
      controller.ledger = next;
    }),
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: vi.fn(),
  };
  const status: PaymentInboxStatus = {
    available: true,
    enabled: false,
    sources: [],
    bookId: "",
    permissionGranted: false,
    connected: false,
    pendingCount: 1,
    error: "",
  };
  let pending = [receipt];
  const adapter: PaymentInboxAdapter = {
    status: vi.fn(async () => ({ ...status })),
    pending: vi.fn(async () => pending),
    configure: vi.fn(async (config: PaymentInboxConfig) => {
      Object.assign(status, config);
    }),
    handled: vi.fn(
      async (input: {
        id: string;
        state: HandledPaymentState;
        recordId?: string;
      }) => {
        pending = pending.filter((item) => item.id !== input.id);
      },
    ),
    clear: vi.fn(async () => {
      pending = [];
    }),
    openSettings: vi.fn(async () => {}),
    subscribe: (listener) => {
      subscriptions.native.add(listener);
      return () => subscriptions.native.delete(listener);
    },
  };
  return { controller, adapter };
}
async function loaded(input: ReturnType<typeof fixture>) {
  const hook = renderHook(() => usePaymentInbox(input));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}
describe("native payment inbox controller", () => {
  it("loading and collecting never writes a ledger", async () => {
    const input = fixture(),
      hook = await loaded(input);
    expect(hook.result.current.receipts).toHaveLength(1);
    expect(input.controller.commit).not.toHaveBeenCalled();
    expect(input.controller.ledger.records).toHaveLength(0);
  });
  it("preserves pending receipts when the ledger write fails", async () => {
    const input = fixture();
    vi.mocked(input.controller.commit).mockRejectedValueOnce(
      new Error("storage-full"),
    );
    const hook = await loaded(input);
    await act(async () => {
      await expect(
        hook.result.current.confirm({ receipt, entry, orderId: "" }),
      ).rejects.toThrow("storage-full");
    });
    expect(input.adapter.handled).not.toHaveBeenCalled();
    expect(hook.result.current.receipts).toHaveLength(1);
    expect(input.controller.ledger.records).toHaveLength(0);
  });
  it("acknowledgement failure retries the saved record without posting again", async () => {
    const input = fixture();
    vi.mocked(input.adapter.handled).mockRejectedValueOnce(
      new Error("ack-failed"),
    );
    const hook = await loaded(input);
    await act(async () => {
      await expect(
        hook.result.current.confirm({ receipt, entry, orderId: "" }),
      ).rejects.toThrow("账单已保存");
    });
    expect(input.controller.ledger.records).toHaveLength(1);
    await act(async () => {
      await hook.result.current.confirm({ receipt, entry, orderId: "" });
    });
    expect(input.controller.commit).toHaveBeenCalledTimes(1);
    expect(input.controller.ledger.records).toHaveLength(1);
    expect(hook.result.current.receipts).toHaveLength(0);
  });
  it("refuses changed books and archived targets", async () => {
    const input = fixture(),
      hook = await loaded(input);
    input.controller.mode = "demo";
    await act(async () => {
      await expect(
        hook.result.current.confirm({ receipt, entry, orderId: "" }),
      ).rejects.toThrow("账本已切换");
    });
    input.controller.mode = "personal";
    input.controller.books = input.controller.books.map((book) =>
      book.id === "personal" ? { ...book, isArchived: true } : book,
    );
    await act(async () => {
      await expect(
        hook.result.current.confirm({ receipt, entry, orderId: "" }),
      ).rejects.toThrow("已归档");
    });
    expect(input.controller.commit).not.toHaveBeenCalled();
  });
  it("will not commit a stale ledger after awaiting native storage", async () => {
    const input = fixture(),
      hook = await loaded(input);
    let resolvePending: (value: PaymentReceipt[]) => void = () => {};
    vi.mocked(input.adapter.pending).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );
    let outcome: Promise<void> | undefined;
    await act(async () => {
      outcome = hook.result.current.confirm({ receipt, entry, orderId: "" });
      await Promise.resolve();
      input.controller.ledger = { ...seed, rules: { QA: "餐饮" } };
      resolvePending([receipt]);
      await expect(outcome).rejects.toThrow("账本已更新");
    });
    expect(input.controller.commit).not.toHaveBeenCalled();
    expect(input.adapter.handled).not.toHaveBeenCalled();
  });
  it("unmounting before storage validation prevents a late financial write", async () => {
    const input = fixture(),
      hook = await loaded(input);
    let resolvePending: (value: PaymentReceipt[]) => void = () => {};
    vi.mocked(input.adapter.pending).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );
    const outcome = hook.result.current.confirm({
      receipt,
      entry,
      orderId: "",
    });
    hook.unmount();
    resolvePending([receipt]);
    await expect(outcome).rejects.toThrow("页面或账本已切换");
    expect(input.controller.commit).not.toHaveBeenCalled();
    expect(subscriptions.native.size).toBe(0);
    expect(subscriptions.state.size).toBe(0);
  });
  it("ignoring and clearing affect only the inbox", async () => {
    const input = fixture(),
      hook = await loaded(input);
    await act(async () => {
      expect(await hook.result.current.discard(receipt)).toBe(true);
      expect(await hook.result.current.clear()).toBe(true);
    });
    expect(input.controller.commit).not.toHaveBeenCalled();
    expect(input.controller.ledger).toBe(seed);
  });
  it("blocks enabling an archived book but permits disabling collection", async () => {
    const input = fixture(),
      hook = await loaded(input);
    input.controller.books = input.controller.books.map((book) =>
      book.id === "personal" ? { ...book, isArchived: true } : book,
    );
    await act(async () => {
      expect(
        await hook.result.current.configure({
          enabled: true,
          sources: ["微信支付"],
          bookId: "personal",
        }),
      ).toBe(false);
    });
    expect(input.adapter.configure).not.toHaveBeenCalled();
    await act(async () => {
      expect(
        await hook.result.current.configure({
          enabled: false,
          sources: [],
          bookId: "",
        }),
      ).toBe(true);
    });
    expect(input.adapter.configure).toHaveBeenCalledTimes(1);
  });
});
