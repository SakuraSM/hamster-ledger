// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import { PendingScreen } from "../../apps/mobile/src/screens/PendingScreen";

vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ImageBackground: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  StyleSheet: { create: <T,>(value: T): T => value },
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  useTheme: () => ({ dark: false, colors: { surfaceVariant: "#eee" } }),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
afterEach(cleanup);

function ledger(isHidden: boolean): Ledger {
  const demo = createDemoLedger();
  return {
    ...demo,
    records: [
      {
        ...demo.records[0]!,
        merchant: "测试午餐",
        amount: 3200,
        kind: "支出",
        status: "pending",
      },
    ],
    reviews: [],
    aiDrafts: [],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: isHidden },
  };
}
it("routes a real pending record to review without confirming it", () => {
  const book = ledger(false),
    review = vi.fn();
  render(
    <PendingScreen
      ledger={book}
      onReview={review}
      onAi={vi.fn()}
      onPayment={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText("测试午餐")).toBeTruthy();
  expect(screen.getByText("− ¥32.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "核对这笔账单" }));
  expect(review).toHaveBeenCalledOnce();
  expect(book.records[0]?.status).toBe("pending");
});
it("hides amounts and identifying merchant text when privacy is enabled", () => {
  const { container } = render(
    <PendingScreen
      ledger={ledger(true)}
      onReview={vi.fn()}
      onAi={vi.fn()}
      onPayment={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(container.textContent).not.toContain("32.00");
  expect(container.textContent).not.toContain("测试午餐");
  expect(screen.getByText("••••")).toBeTruthy();
});

it("shows an actual pending member of a review pair", () => {
  const book = createDemoLedger();
  const pair = book.reviews.find((review) => review.state === "pending")!;
  const pending = book.records.find(
    (record) =>
      [pair.leftId, pair.rightId].includes(record.id) &&
      record.status === "pending",
  )!;
  render(
    <PendingScreen
      ledger={book}
      onReview={vi.fn()}
      onAi={vi.fn()}
      onPayment={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText(pending.merchant)).toBeTruthy();
});

it("never combines an incomplete AI draft with another pending record", () => {
  const book = ledger(false);
  book.aiDrafts = [
    {
      id: "draft",
      sourceHash: "hash",
      source: "text-rule",
      sourceLabel: "文本",
      createdAt: "2026-09-30",
      attachmentIds: [],
      state: "pending",
      candidate: {
        type: "expense",
        amount: "80.00",
        currency: "CNY",
        date: "",
        merchant: "",
        category: "待分类",
        accountId: null,
        description: "",
        confidence: 0,
        issues: [],
      },
    },
  ];
  const onAi = vi.fn(),
    onReview = vi.fn();
  const { container } = render(
    <PendingScreen
      ledger={book}
      onReview={onReview}
      onAi={onAi}
      onPayment={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText("交易对象待确认")).toBeTruthy();
  expect(screen.getByText("CNY 80.00")).toBeTruthy();
  expect(container.textContent).not.toContain("测试午餐");
  expect(container.textContent).not.toContain(book.records[0]!.date);
  fireEvent.click(screen.getByRole("button", { name: "核对并入账" }));
  expect(onAi).toHaveBeenCalledOnce();
  expect(onReview).not.toHaveBeenCalled();
});

it("lets a pending record be handled later without changing its status", () => {
  const book = ledger(false),
    later = vi.fn();
  render(
    <PendingScreen
      ledger={book}
      onReview={vi.fn()}
      onAi={vi.fn()}
      onPayment={vi.fn()}
      onImport={vi.fn()}
      onLater={later}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "稍后处理" }));
  expect(later).toHaveBeenCalledOnce();
  expect(book.records[0]?.status).toBe("pending");
});
