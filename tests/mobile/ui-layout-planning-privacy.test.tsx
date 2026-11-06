// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { BudgetScreen } from "../../apps/mobile/src/screens/BudgetScreen";
import { RecurringScreen } from "../../apps/mobile/src/screens/RecurringScreen";
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useTheme: () => ({ dark: false, colors: {} }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Card: Object.assign(Container, { Content: Container }),
    ProgressBar: () => <span>金额进度图</span>,
    Checkbox: { Item: ({ label }: { label: string }) => <span>{label}</span> },
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <button disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
    TextInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <label>
        {label}
        <input
          value={value}
          onChange={(event) => onChangeText(event.currentTarget.value)}
        />
      </label>
    ),
  };
});
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => null,
}));
vi.mock("../../apps/mobile/src/screens/RecurringEditor", () => ({
  RecurringEditor: () => <span>编辑周期规则</span>,
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-12 12:00:00",
  newEntityId: () => "id",
}));
afterEach(cleanup);
function controllerFor(ledger: Ledger): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    books: [],
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: vi.fn(),
    updateBooks: vi.fn(),
    switchMode: vi.fn(),
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
it("masks budget amounts and progress until a user explicitly chooses to edit", () => {
  const example = createDemoLedger();
  const ledger: Ledger = {
    ...example,
    records: [],
    budgets: [
      { id: "budget", month: "2026-10", category: null, amount: 88800 },
    ],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const view = render(<BudgetScreen controller={controllerFor(ledger)} />);
  expect(view.container.textContent).not.toContain("888.00");
  expect(screen.queryByText("金额进度图")).toBeNull();
  expect(
    (screen.getByLabelText("预算金额（元）") as HTMLInputElement).value,
  ).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "调整金额" }));
  expect(
    (screen.getByLabelText("预算金额（元）") as HTMLInputElement).value,
  ).toBe("888");
});
it("masks recurring names and amounts but keeps the edit action", () => {
  const example = createDemoLedger();
  const ledger: Ledger = {
    ...example,
    records: [],
    recurringRules: [
      {
        id: "rule",
        name: "每月 8.88",
        merchant: "8.88",
        amount: 888,
        kind: "支出",
        category: "餐饮",
        accountId: null,
        description: "",
        tags: [],
        frequency: "monthly",
        startDate: "2026-01-01",
        isPaused: false,
      },
    ],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const view = render(<RecurringScreen controller={controllerFor(ledger)} />);
  expect(view.container.textContent).not.toContain("8.88");
  fireEvent.click(screen.getByRole("button", { name: "编辑规则" }));
  expect(screen.getByText("编辑周期规则")).toBeTruthy();
});
