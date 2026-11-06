// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import {
  DEFAULT_BOOKS,
  DEFAULT_PREFERENCES,
  EMPTY_LEDGER,
  type AiDraft,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { PendingReviewPanel } from "../apps/web/src/components/PendingReviewPanel";
import { ReviewPage } from "../apps/web/src/components/ReviewPage";
import { AiPanel } from "../apps/web/src/components/ai/AiPanel";

const { testClient, fakeAi } = vi.hoisted(() => ({
  testClient: { request: vi.fn() },
  fakeAi: {
    text: "",
    setText: vi.fn(),
    images: [{ id: "img", name: "图片金额66.66" }],
    addImages: vi.fn(),
    removeImage: vi.fn(),
    recognize: vi.fn(),
    error: "",
    isAutoPost: false,
    setAutoPost: vi.fn(),
    discard: vi.fn(),
    confirm: vi.fn(),
    isBusy: false,
  },
}));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
vi.mock("../apps/web/src/auth/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../apps/web/src/components/ai/ModelSettingsPanel", () => ({
  ModelSettingsPanel: () => null,
}));
vi.mock("../apps/web/src/components/ai/DraftAttachments", () => ({
  DraftAttachments: () => <span>附件金额77.77</span>,
}));
vi.mock("@hamster-ledger/ledger-react", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@hamster-ledger/ledger-react")>();
  return {
    ...actual,
    useAiLedger: () => fakeAi,
    useModelSettings: () => ({ profile: { config: null }, isLoading: false }),
  };
});
beforeAll(() => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});
afterEach(cleanup);
const sensitive = {
  merchant: "待审支付12.34元",
  candidate: "候选商户56.78元",
  account: "账户99.99元",
  reason: "原因33.33元",
  status: "状态44.44元",
  source: "来源88.88元",
};
const pending: BillRecord = {
  id: "pending",
  date: "2026-11-01 12:00:00",
  merchant: sensitive.merchant,
  description: "",
  amount: 1234,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "支付宝",
  account: sensitive.account,
  accountId: null,
  orderId: "",
  status: "pending",
  sourceStatus: sensitive.status,
  fileName: "",
  raw: {},
  linkedSources: [],
  reason: sensitive.reason,
};
const candidate: BillRecord = {
  ...pending,
  id: "candidate",
  merchant: sensitive.candidate,
  source: "招商银行",
  status: "confirmed",
};
function makeController(ledger: Ledger): LedgerController {
  return {
    books: DEFAULT_BOOKS,
    ledger,
    personalLedger: ledger,
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: () => {},
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
function book(isHidden: boolean): Ledger {
  return {
    ...EMPTY_LEDGER,
    records: [pending, candidate],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: isHidden },
  };
}

it("hides pending and candidate raw text without disabling review", () => {
  const select = vi.fn();
  const { container, rerender } = render(
    <PendingReviewPanel
      controller={makeController(book(true))}
      onSelect={select}
    />,
  );
  for (const value of [sensitive.merchant, sensitive.account, sensitive.reason])
    expect(container.innerHTML).not.toContain(value);
  fireEvent.click(screen.getByRole("combobox", { name: "选择要关联的流水" }));
  expect(document.body.innerHTML).not.toContain(sensitive.candidate);
  fireEvent.click(screen.getByRole("option", { name: /候选账单.*招商银行/ }));
  fireEvent.click(screen.getByRole("button", { name: "查看候选原始流水" }));
  expect(select).toHaveBeenCalledWith(candidate);
  rerender(
    <PendingReviewPanel
      controller={makeController(book(false))}
      onSelect={select}
    />,
  );
  expect(container.textContent).toContain(sensitive.merchant);
  expect(container.textContent).toContain(sensitive.reason);
  expect(container.textContent).toContain(sensitive.account);
});

it("hides both sides of duplicate comparison and raw reasons", () => {
  const ledger = {
    ...book(true),
    reviews: [
      {
        id: "pair",
        leftId: candidate.id,
        rightId: pending.id,
        state: "pending" as const,
        reasons: [sensitive.reason],
      },
    ],
  };
  const select = vi.fn();
  const { container, rerender } = render(
    <ReviewPage controller={makeController(ledger)} onSelect={select} />,
  );
  for (const value of [
    sensitive.merchant,
    sensitive.candidate,
    sensitive.account,
    sensitive.reason,
    sensitive.status,
  ])
    expect(container.innerHTML).not.toContain(value);
  fireEvent.click(screen.getByRole("button", { name: "查看原始记录" }));
  expect(select).toHaveBeenCalledWith(candidate);
  rerender(
    <ReviewPage
      controller={makeController({
        ...ledger,
        preferences: { ...DEFAULT_PREFERENCES, hideAmounts: false },
      })}
      onSelect={select}
    />,
  );
  expect(container.textContent).toContain(sensitive.candidate);
  expect(container.textContent).toContain(sensitive.reason);
});

it("hides AI draft raw values, selected filenames and attachment previews", () => {
  const draft: AiDraft = {
    id: "draft",
    sourceHash: "hash",
    source: "model-image",
    sourceLabel: sensitive.source,
    createdAt: "2026-11-01",
    attachmentIds: ["a"],
    state: "pending",
    candidate: {
      type: "expense",
      amount: "12.34",
      currency: "CNY",
      date: "2026-11-01 12:00:00",
      merchant: sensitive.merchant,
      category: "餐饮",
      accountId: "bank",
      description: sensitive.reason,
      confidence: 0.4,
      issues: [sensitive.reason],
    },
  };
  const ledger = {
    ...book(true),
    accounts: [
      {
        id: "bank",
        name: sensitive.account,
        kind: "asset" as const,
        type: "银行卡" as const,
        openingBalance: 0,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        isArchived: false,
        checkpoints: [],
      },
    ],
    aiDrafts: [draft],
  };
  const { container, rerender } = render(
    <AiPanel controller={makeController(ledger)} onMonth={vi.fn()} />,
  );
  for (const value of [
    sensitive.merchant,
    sensitive.account,
    sensitive.reason,
    sensitive.source,
    "图片金额66.66",
    "附件金额77.77",
    "12.34",
  ])
    expect(container.innerHTML).not.toContain(value);
  expect(screen.getByRole("button", { name: "核对并入账" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "移除第 1 张图片" })).toBeTruthy();
  rerender(
    <AiPanel
      controller={makeController({
        ...ledger,
        preferences: { ...DEFAULT_PREFERENCES, hideAmounts: false },
      })}
      onMonth={vi.fn()}
    />,
  );
  expect(container.textContent).toContain(sensitive.merchant);
  expect(container.textContent).toContain("附件金额77.77");
});
