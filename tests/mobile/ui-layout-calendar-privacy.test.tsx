// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import {
  DEFAULT_PREFERENCES,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { CalendarScreen } from "../../apps/mobile/src/screens/CalendarScreen";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  IconButton: ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => <button aria-label={accessibilityLabel} onClick={onPress} />,
  useTheme: () => ({
    colors: {
      primary: "#a94c2c",
      onPrimary: "#fff",
      onSurface: "#222",
      surface: "#fff",
    },
  }),
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  useAmountColors: () => ({
    income: "#444",
    expense: "#aa4422",
    neutral: "#444",
  }),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/screens/RecordRow", () => ({
  RecordRow: ({
    record,
    isAmountHidden,
    onPress,
  }: {
    record: BillRecord;
    isAmountHidden: boolean;
    onPress: (record: BillRecord) => void;
  }) => (
    <button onClick={() => onPress(record)}>
      {isAmountHidden ? "账单金额已隐藏" : record.merchant}
    </button>
  ),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-12 12:00:00",
}));
afterEach(cleanup);
it("hides calendar amounts and accessibility names while preserving date navigation", () => {
  const example = createDemoLedger();
  const record: BillRecord = {
    ...example.records[0],
    id: "secret",
    merchant: "咖啡 8.88",
    amount: 888,
    date: "2026-10-12 10:00:00",
    status: "confirmed",
    kind: "支出",
  };
  const ledger: Ledger = {
    ...example,
    records: [record],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const onRecord = vi.fn();
  const onAdd = vi.fn();
  const view = render(
    <CalendarScreen ledger={ledger} onRecord={onRecord} onAdd={onAdd} />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "2026-10-12，金额已隐藏" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "账单金额已隐藏" }));
  expect(onRecord).toHaveBeenCalledWith(record);
  fireEvent.click(screen.getByRole("button", { name: "为这一天记一笔" }));
  expect(onAdd).toHaveBeenCalledWith("2026-10-12");
});
