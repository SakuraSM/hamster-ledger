// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  DEFAULT_PREFERENCES,
  EMPTY_LEDGER,
  type Book,
  type Ledger,
  type PaymentReceipt,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { CategoriesScreen } from "../../apps/mobile/src/screens/CategoriesScreen";
import { BooksScreen } from "../../apps/mobile/src/screens/BooksScreen";
import { PaymentReceiptCard } from "../../apps/mobile/src/screens/PaymentReceiptCard";
import { PaymentInboxScreen } from "../../apps/mobile/src/screens/PaymentInboxScreen";
import { paymentUiFixture } from "./payment-ui-fixture";

const alerts = vi.hoisted(() => ({ alert: vi.fn(), inbox: vi.fn() }));
vi.mock("react-native", () => ({
  Alert: { alert: alerts.alert },
  FlatList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: PaymentReceipt[];
    renderItem: (input: { item: PaymentReceipt }) => ReactNode;
    ListHeaderComponent: ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {data.map((item) => (
        <div key={item.id}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
}));
vi.mock("../../apps/mobile/src/hooks/usePaymentInbox", () => ({
  usePaymentInbox: alerts.inbox,
}));
vi.mock("../../apps/mobile/src/hooks/useSystemFontScale", () => ({
  useSystemFontScale: () => 1,
}));
vi.mock("../../apps/mobile/src/screens/PaymentInboxSettings", () => ({
  PaymentInboxSettings: () => null,
}));
vi.mock("../../apps/mobile/src/screens/PaymentReceiptReview", () => ({
  PaymentReceiptReview: () => null,
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  );
  return {
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <button onClick={onPress} disabled={disabled}>
        {children}
      </button>
    ),
    TextInput: ({ label }: { label: string }) => <input aria-label={label} />,
    SegmentedButtons: () => null,
    Card: Object.assign(Container, { Content: Container }),
    List: {
      Item: ({ title, right }: { title: string; right?: () => ReactNode }) => (
        <section data-testid={`book-${title}`}>
          <span>{title}</span>
          {right?.()}
        </section>
      ),
      Icon: () => null,
    },
  };
});
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Section: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: () => null,
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  newEntityId: () => "new",
  localTimestamp: () => "2026-10-12 12:00:00",
}));
afterEach(() => {
  cleanup();
  alerts.alert.mockReset();
  alerts.inbox.mockReset();
});

const ledger: Ledger = {
  ...EMPTY_LEDGER,
  records: [
    {
      id: "history",
      date: "2026-10-01 12:00:00",
      merchant: "虚拟商户",
      description: "历史账单",
      amount: 2000,
      currency: "CNY",
      kind: "支出",
      category: "出差",
      source: "手动记账",
      account: "",
      orderId: "",
      status: "confirmed",
      sourceStatus: "已确认",
      fileName: "manual",
      raw: {},
      linkedSources: [],
    },
  ],
  categories: [
    { id: "office", name: "办公", kind: "支出", order: 20 },
    { id: "travel", name: "出差", kind: "支出", order: 21 },
  ],
};
const books: Book[] = [
  { id: "personal", name: "个人账" },
  { id: "book:office", name: "办公账" },
  { id: "book:travel", name: "旅行账" },
];
type AlertOption = { text: string; onPress?: () => void };
function lastAlert(): {
  title: string;
  message: string;
  options: AlertOption[];
} {
  expect(alerts.alert).toHaveBeenCalled();
  const [title, message, options] = alerts.alert.mock.calls.at(-1) as [
    string,
    string,
    AlertOption[],
  ];
  return { title, message, options };
}
function option(options: AlertOption[], name: string): void {
  options.find((item) => item.text === name)?.onPress?.();
}
function controller(input: {
  commit?: LedgerController["commit"];
  updateBooks?: LedgerController["updateBooks"];
}): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    books,
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    commit: input.commit ?? vi.fn(async () => {}),
    updateBooks: input.updateBooks ?? vi.fn(async () => {}),
    switchMode: vi.fn(),
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: () => {},
  };
}

describe("native archive and discard confirmation", () => {
  it("confirms only the selected category and keeps its history", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(
      () => new Promise<void>(() => {}),
    );
    render(<CategoriesScreen controller={controller({ commit })} />);
    const card = screen.getByText("出差").closest("section")!;
    fireEvent.click(within(card).getByRole("button", { name: "归档分类" }));
    const confirmation = lastAlert();
    expect(confirmation.title + confirmation.message).toContain("出差");
    expect(confirmation.message).toContain("历史");
    option(confirmation.options, "取消");
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole("button", { name: "归档分类" }));
    const next = lastAlert();
    option(next.options, "确认归档");
    option(next.options, "确认归档");
    expect(commit).toHaveBeenCalledTimes(1);
    const promptCount = alerts.alert.mock.calls.length;
    fireEvent.click(within(card).getByRole("button", { name: "归档分类" }));
    expect(alerts.alert).toHaveBeenCalledTimes(promptCount);
    expect(
      commit.mock.calls[0][0].categories?.find((item) => item.id === "travel")
        ?.isArchived,
    ).toBe(true);
    expect(commit.mock.calls[0][0].records).toEqual(ledger.records);
  });

  it("reports category write failure without altering the record", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(async () => {
      throw new Error("只读账本");
    });
    render(<CategoriesScreen controller={controller({ commit })} />);
    fireEvent.click(
      within(screen.getByText("办公").closest("section")!).getByRole("button", {
        name: "归档分类",
      }),
    );
    option(lastAlert().options, "确认归档");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("只读账本"),
    );
    expect(
      ledger.categories?.find((item) => item.id === "office")?.isArchived,
    ).not.toBe(true);
  });

  it("restores an archived category while retaining historical bills", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(async () => {});
    const archived = {
      ...ledger,
      categories: ledger.categories?.map((item) =>
        item.id === "travel" ? { ...item, isArchived: true } : item,
      ),
    };
    render(
      <CategoriesScreen
        controller={{ ...controller({ commit }), ledger: archived }}
      />,
    );
    const card = screen.getByText("出差 · 已归档").closest("section")!;
    fireEvent.click(within(card).getByRole("button", { name: "恢复分类" }));
    await waitFor(() => expect(commit).toHaveBeenCalledOnce());
    expect(
      commit.mock.calls[0][0].categories?.find((item) => item.id === "travel")
        ?.isArchived,
    ).toBe(false);
    expect(commit.mock.calls[0][0].records).toEqual(ledger.records);
    expect(alerts.alert).not.toHaveBeenCalled();
  });

  it("confirms the actual book once and leaves the others unchanged", () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(
      () => new Promise<void>(() => {}),
    );
    render(<BooksScreen controller={controller({ updateBooks })} />);
    const row = screen.getByTestId("book-旅行账");
    fireEvent.click(within(row).getByRole("button", { name: "归档" }));
    const confirmation = lastAlert();
    expect(confirmation.title + confirmation.message).toContain("旅行账");
    expect(confirmation.message).toMatch(/历史|账单/);
    option(confirmation.options, "取消");
    expect(updateBooks).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "归档" }));
    const next = lastAlert();
    option(next.options, "确认归档");
    option(next.options, "确认归档");
    expect(updateBooks).toHaveBeenCalledTimes(1);
    const promptCount = alerts.alert.mock.calls.length;
    fireEvent.click(within(row).getByRole("button", { name: "归档" }));
    expect(alerts.alert).toHaveBeenCalledTimes(promptCount);
    expect(updateBooks.mock.calls[0][0]).toEqual([
      books[0],
      books[1],
      { ...books[2], isArchived: true },
    ]);
  });

  it("does not archive a book that became current while confirmation was open", async () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(async () => {});
    const initial = controller({ updateBooks });
    const view = render(<BooksScreen controller={initial} />);
    fireEvent.click(
      within(screen.getByTestId("book-旅行账")).getByRole("button", {
        name: "归档",
      }),
    );
    const confirmation = lastAlert();
    view.rerender(
      <BooksScreen controller={{ ...initial, mode: "book:travel" }} />,
    );
    option(confirmation.options, "确认归档");
    expect(updateBooks).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("重新确认"),
    );
  });

  it("restores an archived book without an archive confirmation", async () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(async () => {});
    const archived = books.map((book) =>
      book.id === "book:travel" ? { ...book, isArchived: true } : book,
    );
    render(
      <BooksScreen
        controller={{ ...controller({ updateBooks }), books: archived }}
      />,
    );
    fireEvent.click(
      within(screen.getByTestId("book-旅行账")).getByRole("button", {
        name: "恢复",
      }),
    );
    await waitFor(() => expect(updateBooks).toHaveBeenCalledOnce());
    expect(updateBooks.mock.calls[0][0][2]).toEqual({
      ...books[2],
      isArchived: false,
    });
    expect(alerts.alert).not.toHaveBeenCalled();
  });

  it("confirms the specific payment message before ignoring it", () => {
    const { receipt } = paymentUiFixture();
    const discard = vi.fn(() => new Promise<boolean>(() => {}));
    render(
      <PaymentReceiptCard
        receipt={receipt}
        books={books}
        mode="personal"
        isBusy={false}
        isRecorded={false}
        hideAmounts={false}
        onReview={vi.fn()}
        onDiscard={discard}
      />,
    );
    expect(screen.getByText(/¥12\.34/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
    const confirmation = lastAlert();
    expect(confirmation.title + confirmation.message).toContain(receipt.source);
    expect(confirmation.message).toContain("12.34");
    expect(confirmation.message).toMatch(/不.*账单/);
    option(confirmation.options, "取消");
    expect(discard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
    const next = lastAlert();
    option(next.options, "确认忽略");
    option(next.options, "确认忽略");
    expect(discard).toHaveBeenCalledOnce();
    expect(discard).toHaveBeenCalledWith(receipt);
    const promptCount = alerts.alert.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
    expect(alerts.alert).toHaveBeenCalledTimes(promptCount);
  });

  it("allows retrying an ignored message after a failed storage operation", async () => {
    const { receipt } = paymentUiFixture();
    const discard = vi.fn(async () => false);
    render(
      <PaymentReceiptCard
        receipt={receipt}
        books={books}
        mode="personal"
        isBusy={false}
        isRecorded={false}
        hideAmounts={false}
        onReview={vi.fn()}
        onDiscard={discard}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
    option(lastAlert().options, "确认忽略");
    await waitFor(() => expect(discard).toHaveBeenCalledOnce());
    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
      expect(alerts.alert).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    {
      hideAmounts: true,
      bookId: "personal" as const,
      mode: "personal" as const,
    },
    {
      hideAmounts: false,
      bookId: "book:office" as const,
      mode: "personal" as const,
    },
    {
      hideAmounts: false,
      bookId: "book:missing" as const,
      mode: "book:missing" as const,
    },
  ])(
    "hides message amounts and confirmation details for $bookId",
    ({ hideAmounts, bookId, mode }) => {
      const { receipt: original } = paymentUiFixture();
      const receipt = {
        ...original,
        bookId,
        text: "商户:咖啡店 支付成功12.34元",
      };
      alerts.inbox.mockReturnValue({
        status: null,
        receipts: [receipt],
        error: "",
        isLoading: false,
        isBusy: false,
        discard: vi.fn(),
      });
      const current = controller({});
      const { container } = render(
        <PaymentInboxScreen
          controller={{
            ...current,
            mode,
            ledger: {
              ...current.ledger,
              preferences: { ...DEFAULT_PREFERENCES, hideAmounts },
            },
          }}
        />,
      );
      expect(container.textContent).not.toContain("12.34");
      expect(container.textContent).toContain("••••");
      for (const element of container.querySelectorAll("[aria-label]"))
        expect(element.getAttribute("aria-label")).not.toContain("12.34");
      fireEvent.click(screen.getByRole("button", { name: "忽略此消息" }));
      const confirmation = lastAlert();
      expect(confirmation.title + confirmation.message).not.toContain("12.34");
      expect(confirmation.message).toContain("••••");
    },
  );
});
