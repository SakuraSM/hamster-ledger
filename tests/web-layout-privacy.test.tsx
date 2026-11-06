// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  type BillRecord,
} from "@hamster-ledger/core";
import { createStatement } from "@hamster-ledger/importers";
import { FieldMapping } from "../apps/web/src/components/FieldMapping";
import { TransactionTable } from "../apps/web/src/components/TransactionTable";
import type { PlanningPanelController } from "@hamster-ledger/ledger-react";
import { GoalsList } from "../apps/web/src/components/finance/GoalsList";
import { DebtsList } from "../apps/web/src/components/finance/DebtsList";
import { SubscriptionsList } from "../apps/web/src/components/finance/SubscriptionsList";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ReviewPage } from "../apps/web/src/components/ReviewPage";
import { SimpleEntryEditor } from "../apps/web/src/components/SimpleEntryEditor";
import { RecordDetail } from "../apps/web/src/components/RecordDetail";
import { BudgetPage } from "../apps/web/src/components/planning/BudgetPage";
import { CalendarPage } from "../apps/web/src/components/planning/CalendarPage";
import { ReportsPage } from "../apps/web/src/components/planning/ReportsPage";
import { RecurringPage } from "../apps/web/src/components/planning/RecurringPage";

const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
afterEach(cleanup);
const bill: BillRecord = {
  id: "privacy-bill",
  date: "2026-11-01 12:00:00",
  merchant: "午餐",
  description: "",
  amount: 123456,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "手动记账",
  account: "现金",
  accountId: null,
  orderId: "",
  status: "confirmed",
  sourceStatus: "成功",
  fileName: "",
  raw: { 金额: "1234.56" },
  linkedSources: [],
};
const ledger = {
  ...EMPTY_LEDGER,
  records: [bill],
  preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  budgets: [{ id: "budget", month: "2026-11", category: null, amount: 300000 }],
  recurringRules: [
    {
      id: "rule",
      name: "房租",
      merchant: "房租",
      amount: 150000,
      kind: "支出" as const,
      category: "居住",
      accountId: null,
      description: "",
      tags: [],
      frequency: "monthly" as const,
      startDate: "2026-01-01",
      isPaused: false,
    },
  ],
};

describe("hidden amounts on ledger pages", () => {
  it("masks transaction rows while keeping the bill action available", () => {
    render(
      <TransactionTable records={[bill]} hideAmounts onSelect={vi.fn()} />,
    );
    expect(screen.queryByText(/1,234\.56/)).toBeNull();
    expect(screen.getByText("••••")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "查看午餐账单详情" }),
    ).toBeTruthy();
  });
  it("does not expose amounts in calendar text or accessible day names", () => {
    render(
      <CalendarPage
        ledger={ledger}
        month="2026-11"
        onMonth={vi.fn()}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.queryByText(/1,234\.56/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "2026-11-01，金额已隐藏" }),
    ).toBeTruthy();
  });
  it("hides raw monetary values in record details", () => {
    render(
      <RecordDetail
        ledger={ledger}
        record={bill}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onRelated={vi.fn()}
      />,
    );
    expect(screen.queryByText(/1,234\.56/)).toBeNull();
    fireEvent.click(screen.getByText("查看原始字段"));
    expect(screen.queryByText("1234.56")).toBeNull();
  });
  it("hides budget and recurring amounts", () => {
    const { unmount } = render(
      <BudgetPage
        ledger={ledger}
        month="2026-11"
        onMonth={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    expect(screen.queryByText(/3,000\.00/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    unmount();
    render(<RecurringPage ledger={ledger} onCommit={vi.fn()} />);
    expect(screen.queryByText(/1,500\.00/)).toBeNull();
  });
  it("hides report values and charts", () => {
    render(<ReportsPage ledger={ledger} month="2026-11" />);
    expect(screen.queryByText(/1,234\.56/)).toBeNull();
    expect(
      screen.queryByRole("group", { name: /收支占比图|净资产曲线/ }),
    ).toBeNull();
  });
  it("masks mapping examples in cells, titles, and option names without disabling selection", async () => {
    const file = createStatement({
      name: "example.csv",
      hash: "masked",
      rows: [
        ["发生时点", "交易对方", "发生数值", "收支"],
        ["2026-11-01", "合成商户", "1234.56", "支出"],
      ],
    });
    const onChange = vi.fn();
    const { container } = render(
      <FieldMapping
        file={{ ...file, mapping: { ...file.mapping, amount: undefined } }}
        hideAmounts
        onChange={onChange}
      />,
    );
    expect(container.textContent).not.toContain("1234.56");
    expect(container.querySelector('[title="1234.56"]')).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "金额" }));
    expect(screen.queryByRole("option", { name: /1234\.56/ })).toBeNull();
    fireEvent.click(
      await screen.findByRole("option", { name: "第 3 列 · 发生数值" }),
    );
    expect(onChange.mock.calls.at(-1)?.[0].mapping.amount).toBe(2);
  });
  it("hides amounts in review evidence and candidate names", () => {
    const pending = {
      ...bill,
      id: "other",
      source: "招商银行" as const,
      status: "pending" as const,
    };
    const reviewLedger = {
      ...ledger,
      records: [bill, pending],
      reviews: [
        {
          id: "review",
          leftId: bill.id,
          rightId: pending.id,
          state: "pending" as const,
          reasons: ["金额相同"],
        },
      ],
    };
    const controller: LedgerController = {
      books: DEFAULT_BOOKS,
      ledger: reviewLedger,
      personalLedger: reviewLedger,
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
    const onSelect = vi.fn();
    const { container } = render(
      <ReviewPage controller={controller} onSelect={onSelect} />,
    );
    expect(container.textContent).not.toContain("1,234.56");
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /确认关联/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看原始记录" }));
    expect(onSelect).toHaveBeenCalledWith(bill);
    fireEvent.click(screen.getByRole("button", { name: "查看另一条原始记录" }));
    expect(onSelect).toHaveBeenCalledWith(pending);
  });
  it("keeps the protected amount editable when opening a bill", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SimpleEntryEditor
        ledger={ledger}
        record={bill}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/金额（元）/) as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.change(input, { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "保存账单" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].amount).toBe(20000);
  });
  it("masks subscription, debt, and savings values and their progress", () => {
    const panel: PlanningPanelController = {
      tab: "goals",
      setTab: vi.fn(),
      form: null,
      setForm: vi.fn(),
      error: "",
      isBusy: false,
      commit: vi.fn(),
    };
    const goal = {
      id: "goal",
      name: "旅行",
      target: 300000,
      accountId: null,
      isArchived: false,
      allocations: [],
    };
    const debt = {
      id: "debt",
      name: "借款",
      direction: "receivable" as const,
      currency: "CNY" as const,
      principal: 300000,
      accountId: "cash",
      counterAccountId: "loan",
      openedOn: "2026-01-01",
      isArchived: false,
    };
    const subscription = {
      id: "sub",
      name: "会员",
      amount: 300000,
      currency: "CNY" as const,
      accountId: null,
      category: "娱乐",
      cycle: "monthly" as const,
      interval: 1,
      anchorDay: 1,
      nextDate: "2026-12-01",
      status: "active" as const,
      autoPost: false,
      reminderDays: 3,
      skippedDates: [],
      isArchived: false,
    };
    const privateLedger = {
      ...ledger,
      goals: [goal],
      debts: [debt],
      subscriptions: [subscription],
    };
    const { unmount } = render(
      <GoalsList ledger={privateLedger} panel={panel} />,
    );
    expect(screen.queryByText(/3,000\.00/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    unmount();
    const debts = render(<DebtsList ledger={privateLedger} panel={panel} />);
    expect(screen.queryByText(/3,000\.00/)).toBeNull();
    debts.unmount();
    render(<SubscriptionsList ledger={privateLedger} panel={panel} />);
    expect(screen.queryByText(/3,000\.00/)).toBeNull();
  });
});
