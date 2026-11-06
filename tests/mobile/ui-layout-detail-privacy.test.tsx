// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { RecordDetail } from "../../apps/mobile/src/screens/RecordDetail";
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({
    dark: false,
    colors: {
      outlineVariant: "#ccc",
      onSurfaceVariant: "#555",
      surfaceVariant: "#eee",
    },
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Divider: () => <hr />,
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: () => null,
  styles: { row: {} },
}));
vi.mock("../../apps/mobile/src/screens/RecordAttachments", () => ({
  RecordAttachments: () => <span>凭证金额 8.88</span>,
}));
vi.mock("../../apps/mobile/src/screens/TransactionFacts", () => ({
  TransactionFacts: () => <span>原币金额 8.88</span>,
}));
afterEach(cleanup);
it("keeps record detail, raw data and accessibility free of amounts until editing", () => {
  const example = createDemoLedger();
  const record = {
    ...example.records[0],
    merchant: "咖啡 8.88",
    amount: 888,
    description: "金额 8.88",
    raw: { 金额: "8.88" },
  };
  const ledger: Ledger = {
    ...example,
    records: [record],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const onEdit = vi.fn();
  const controller: LedgerController = {
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
  const view = render(
    <RecordDetail
      controller={controller}
      record={record}
      onClose={vi.fn()}
      onEdit={onEdit}
    />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "编辑账单" }));
  expect(onEdit).toHaveBeenCalledWith(record);
});
