// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import { EMPTY_LEDGER, type RecurringRule } from "@hamster-ledger/core";
import { BudgetPage } from "../apps/web/src/components/planning/BudgetPage";
import { GoalsList } from "../apps/web/src/components/finance/GoalsList";
import { DebtsList } from "../apps/web/src/components/finance/DebtsList";
import { SubscriptionsList } from "../apps/web/src/components/finance/SubscriptionsList";
import type { PlanningPanelController } from "@hamster-ledger/ledger-react";
import { RecurringPage } from "../apps/web/src/components/planning/RecurringPage";

afterEach(cleanup);
const recurring: RecurringRule = {
  id: "rule-1",
  name: "房租",
  merchant: "房租",
  amount: 150000,
  kind: "支出",
  category: "居住",
  accountId: null,
  description: "",
  tags: [],
  frequency: "monthly",
  startDate: "2026-01-01",
  isPaused: false,
};

describe("planning actions", () => {
  it("requires confirmation before removing a budget", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const ledger = {
      ...EMPTY_LEDGER,
      budgets: [
        { id: "budget-1", month: "2026-11", category: null, amount: 300000 },
      ],
    };
    render(
      <BudgetPage
        ledger={ledger}
        month="2026-11"
        onMonth={vi.fn()}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "删除预算" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    expect(onCommit.mock.calls[0][0].budgets).toEqual([]);
  });
  it("requires confirmation before removing a recurring rule", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(
      <RecurringPage
        ledger={{ ...EMPTY_LEDGER, recurringRules: [recurring] }}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除规则" }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "删除周期规则" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    expect(onCommit.mock.calls[0][0].recurringRules).toEqual([]);
  });
  it("confirms archive or cancellation for the selected planning object", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    const panel: PlanningPanelController = {
      tab: "goals",
      setTab: vi.fn(),
      form: null,
      setForm: vi.fn(),
      error: "",
      isBusy: false,
      commit,
    };
    const goal = {
      id: "goal",
      name: "旅行",
      target: 100000,
      accountId: null,
      isArchived: false,
      allocations: [],
    };
    const { unmount } = render(
      <GoalsList ledger={{ ...EMPTY_LEDGER, goals: [goal] }} panel={panel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "归档目标" }));
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByText(/归档“旅行”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
    await waitFor(() => expect(commit).toHaveBeenCalledOnce());
    unmount();
    commit.mockClear();
    const debt = {
      id: "debt",
      name: "借款",
      direction: "receivable" as const,
      currency: "CNY" as const,
      principal: 100000,
      accountId: "cash",
      counterAccountId: "loan",
      openedOn: "2026-01-01",
      isArchived: false,
    };
    const debts = render(
      <DebtsList ledger={{ ...EMPTY_LEDGER, debts: [debt] }} panel={panel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "归档台账" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
    await waitFor(() => expect(commit).toHaveBeenCalledOnce());
    debts.unmount();
    commit.mockClear();
    const subscription = {
      id: "sub",
      name: "会员",
      amount: 5000,
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
    render(
      <SubscriptionsList
        ledger={{ ...EMPTY_LEDGER, subscriptions: [subscription] }}
        panel={panel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消订阅" }));
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认取消订阅" }));
    await waitFor(() => expect(commit).toHaveBeenCalledOnce());
  });
  it("keeps the delete confirmation open and shows a storage failure", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("存储失败"));
    const ledger = {
      ...EMPTY_LEDGER,
      budgets: [
        { id: "budget-1", month: "2026-11", category: null, amount: 300000 },
      ],
    };
    render(
      <BudgetPage
        ledger={ledger}
        month="2026-11"
        onMonth={vi.fn()}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: "删除预算" }).textContent,
      ).toContain("存储失败"),
    );
  });
});
