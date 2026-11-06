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
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { TransactionsScreen } from "../../apps/mobile/src/screens/TransactionsScreen";
let record: BillRecord;
vi.mock("@hamster-ledger/ledger-react", () => ({
  useBookMembers: () => [],
  useTransactionQuery: () => ({
    records: [record],
    summary: { income: 0, expense: 888, net: -888 },
    error: "",
  }),
  useBatchRecords: () => ({ selected: [], toggle: vi.fn(), select: vi.fn() }),
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FlatList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: BillRecord[];
    renderItem: (value: { item: BillRecord }) => ReactNode;
    ListHeaderComponent: ReactNode;
  }) => (
    <main>
      {ListHeaderComponent}
      {data.map((item) => (
        <div key={item.id}>{renderItem({ item })}</div>
      ))}
    </main>
  ),
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
  Searchbar: ({
    value,
    onChangeText,
  }: {
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <input
      aria-label="搜索账单"
      value={value}
      onChange={(event) => onChangeText(event.currentTarget.value)}
    />
  ),
  SegmentedButtons: () => <span>账单状态</span>,
  Checkbox: {
    Item: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <button onClick={onPress}>{label}</button>
    ),
  },
  List: {
    Item: ({
      title,
      description,
      accessibilityLabel,
      onPress,
      right,
    }: {
      title: string;
      description: string;
      accessibilityLabel: string;
      onPress: () => void;
      right: () => ReactNode;
    }) => (
      <button aria-label={accessibilityLabel} onClick={onPress}>
        {title} {description} {right()}
      </button>
    ),
    Icon: () => null,
  },
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client: {} }),
}));
vi.mock("../../apps/mobile/src/hooks/useSystemFontScale", () => ({
  useSystemFontScale: () => 1,
}));
vi.mock("../../apps/mobile/src/screens/SavedFilters", () => ({
  SavedFilters: () => null,
}));
vi.mock("../../apps/mobile/src/screens/RecordFilters", () => ({
  RecordFilters: () => null,
  EMPTY_FILTER: {
    accountId: "",
    memberId: "",
    reimbursement: "",
    category: "",
    startDate: "",
    endDate: "",
    kind: "",
    status: "",
  },
}));
vi.mock("../../apps/mobile/src/screens/BatchActions", () => ({
  BatchActions: () => <span>批量操作</span>,
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: () => null,
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  useAmountColors: () => ({ income: "#444", expense: "#444", neutral: "#444" }),
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
it("masks amounts and amount-bearing row names in both normal and batch mode", () => {
  const example = createDemoLedger();
  record = {
    ...example.records[0],
    merchant: "咖啡 8.88",
    amount: 888,
    status: "confirmed",
  };
  const ledger: Ledger = {
    ...example,
    records: [record],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const onRecord = vi.fn();
  const view = render(
    <TransactionsScreen
      controller={controllerFor(ledger)}
      onRecord={onRecord}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "批量整理" }));
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /账单，.*金额已隐藏/ }));
  expect(onRecord).toHaveBeenCalledWith(record);
  expect(screen.getByRole("button", { name: /选择 .* 的账单/ })).toBeTruthy();
});
