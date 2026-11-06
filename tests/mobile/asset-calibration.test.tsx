// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { BalanceCalibration } from "../../apps/mobile/src/screens/BalanceCalibration";

const save = vi.fn();
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  Card: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  useTheme: () => ({
    colors: {
      onSurfaceVariant: "#555",
      surfaceVariant: "#eee",
      outlineVariant: "#ccc",
    },
  }),
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
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
}));
vi.mock("@hamster-ledger/ledger-react", () => ({
  useBalanceCalibration: () => {
    const [amount, setAmount] = useState("");
    const [at, setAt] = useState("2026-11-06 17:30:00");
    const [note, setNote] = useState("");
    return {
      amount,
      at,
      note,
      setAmount,
      setAt,
      setNote,
      error: "",
      isSaving: false,
      preview:
        amount === "31.80"
          ? { expected: 3200, actual: 3180, difference: -20 }
          : null,
      save,
    };
  },
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-11-06 17:30:00",
  newEntityId: () => "checkpoint",
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => <span>余额确认时间</span>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));
afterEach(() => {
  cleanup();
  save.mockReset();
});

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
it("reviews the balance difference before saving a new baseline", () => {
  const ledger = createDemoLedger();
  render(
    <BalanceCalibration
      controller={controllerFor(ledger)}
      account={ledger.accounts[0]}
      date="2026-11-06"
      onClose={vi.fn()}
      onFindRecords={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText("请输入有效的实际余额。")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("实际余额"), {
    target: { value: "31.80" },
  });
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
  expect(screen.getByText(/校准差额/)).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  expect(save).toHaveBeenCalledOnce();
});

it("opens missing account records from the review without taking the ordinary close path", () => {
  const ledger = createDemoLedger();
  const onClose = vi.fn();
  const onFindRecords = vi.fn();
  render(
    <BalanceCalibration
      controller={controllerFor(ledger)}
      account={ledger.accounts[0]}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={onFindRecords}
    />,
  );
  fireEvent.change(screen.getByLabelText("实际余额"), {
    target: { value: "31.80" },
  });
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
  fireEvent.click(screen.getByRole("button", { name: "先查找遗漏的账单" }));
  expect(onFindRecords).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
