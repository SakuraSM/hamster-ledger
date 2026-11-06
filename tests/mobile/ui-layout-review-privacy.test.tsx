// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import {
  DEFAULT_PREFERENCES,
  type BillRecord,
  type Ledger,
  type Review,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ReviewScreen } from "../../apps/mobile/src/screens/ReviewScreen";
let pendingRecord: BillRecord;
let pendingCandidate: BillRecord;
const resolve = vi.fn();
vi.mock("@hamster-ledger/ledger-react", () => ({
  usePendingReview: () => ({
    record: pendingRecord,
    candidate: pendingCandidate,
    records: [pendingRecord],
    candidates: [pendingCandidate],
    isBusy: false,
    error: "",
    selectRecord: vi.fn(),
    selectCandidate: vi.fn(),
    resolve,
  }),
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FlatList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: Review[];
    renderItem: (item: { item: Review }) => ReactNode;
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
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Card: Object.assign(Container, { Content: Container }),
    useTheme: () => ({ dark: false, colors: {} }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
  };
});
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  styles: { row: {}, content: {} },
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({
    options,
  }: {
    options: Array<{ value: string; label: string }>;
  }) => (
    <select>
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../../apps/mobile/src/hooks/useSystemFontScale", () => ({
  useSystemFontScale: () => 1,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
it("masks duplicate and pending candidates while preserving review actions", () => {
  const example = createDemoLedger();
  pendingRecord = {
    ...example.records[0],
    id: "left",
    merchant: "咖啡 8.88",
    amount: 888,
    reason: "金额 8.88",
    account: "8.88",
  };
  pendingCandidate = {
    ...example.records[0],
    id: "right",
    merchant: "另一个 8.88",
    amount: 888,
  };
  const review: Review = {
    id: "review",
    leftId: "left",
    rightId: "right",
    state: "pending",
    reasons: ["金额 8.88"],
  };
  const ledger: Ledger = {
    ...example,
    records: [pendingRecord, pendingCandidate],
    reviews: [review],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const controller = controllerFor(ledger);
  const view = render(
    <ReviewScreen controller={controller} onRecord={vi.fn()} />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "合并为一笔" }));
  expect(controller.decide).toHaveBeenCalledWith(review, "linked");
  fireEvent.click(screen.getByRole("button", { name: "关联所选流水" }));
  expect(resolve).toHaveBeenCalledWith("link");
});
