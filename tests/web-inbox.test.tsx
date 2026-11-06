// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import { InboxPage } from "../apps/web/src/components/InboxPage";

afterEach(cleanup);
function pendingLedger(isHidden: boolean): Ledger {
  const ledger = createDemoLedger();
  return {
    ...ledger,
    records: [
      {
        ...ledger.records[0]!,
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
it("shows a real pending record and routes to review without confirming it", () => {
  const ledger = pendingLedger(false);
  const review = vi.fn();
  render(
    <InboxPage
      ledger={ledger}
      month="2026-09"
      onReview={review}
      onAi={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText("测试午餐")).toBeTruthy();
  expect(screen.getByText("− ¥32.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "核对这笔账单" }));
  expect(review).toHaveBeenCalledOnce();
  expect(ledger.records[0]?.status).toBe("pending");
});
it("does not expose pending amounts or merchant text while privacy is enabled", () => {
  const { container } = render(
    <InboxPage
      ledger={pendingLedger(true)}
      month="2026-09"
      onReview={vi.fn()}
      onAi={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(container.textContent).not.toContain("32.00");
  expect(container.textContent).not.toContain("测试午餐");
  expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
});

it("shows an actual pending member of a review pair", () => {
  const ledger = createDemoLedger();
  const pair = ledger.reviews.find((review) => review.state === "pending")!;
  const pending = ledger.records.find(
    (record) =>
      [pair.leftId, pair.rightId].includes(record.id) &&
      record.status === "pending",
  )!;
  render(
    <InboxPage
      ledger={ledger}
      month="2026-09"
      onReview={vi.fn()}
      onAi={vi.fn()}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText(pending.merchant)).toBeTruthy();
});

it("never fills an incomplete AI draft with another pending record's fields", () => {
  const ledger = pendingLedger(false);
  ledger.aiDrafts = [
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
    <InboxPage
      ledger={ledger}
      month="2026-09"
      onReview={onReview}
      onAi={onAi}
      onImport={vi.fn()}
      onLater={vi.fn()}
    />,
  );
  expect(screen.getByText("交易对象待确认")).toBeTruthy();
  expect(screen.getByText("CNY 80.00")).toBeTruthy();
  expect(container.textContent).not.toContain("测试午餐");
  expect(container.textContent).not.toContain(ledger.records[0]!.date);
  fireEvent.click(screen.getByRole("button", { name: "核对并入账" }));
  expect(onAi).toHaveBeenCalledOnce();
  expect(onReview).not.toHaveBeenCalled();
});
