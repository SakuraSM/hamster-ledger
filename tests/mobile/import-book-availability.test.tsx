// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_LEDGER, type Book } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ImportScreen } from "../../apps/mobile/src/screens/ImportScreen";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useTheme: () => ({ colors: { outlineVariant: "#ccc" } }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Card: Object.assign(Container, { Content: Container }),
    ProgressBar: () => null,
    Checkbox: { Item: () => null },
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
vi.mock("../../apps/mobile/src/platform/files", () => ({
  pickStatements: vi.fn(),
  readStatement: vi.fn(),
  shareImportErrors: vi.fn(),
}));
vi.mock("../../apps/mobile/src/platform/storage", () => ({
  nativeStore: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock("../../apps/mobile/src/screens/StatementMapping", () => ({
  StatementMapping: () => null,
}));
vi.mock("../../apps/mobile/src/screens/ReceiptAction", () => ({
  ReceiptAction: () => null,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  ErrorMessage: () => null,
}));
afterEach(cleanup);
const demo: Book = { id: "demo", name: "示例账本" };
const cloud = {
  id: "remote",
  userId: "owner",
  server: "https://test",
  role: "owner" as const,
};
function controller(books: Book[]): LedgerController {
  return {
    books,
    ledger: EMPTY_LEDGER,
    personalLedger: EMPTY_LEDGER,
    mode: "demo",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: vi.fn(),
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
describe("Android demo import destination", () => {
  it.each([
    ["hidden", [demo, { id: "book:local", name: "其他本机账本" }]],
    [
      "archived",
      [demo, { id: "personal", name: "个人账本", isArchived: true }],
    ],
  ] as [string, Book[]][])(
    "explains and disables the unavailable personal destination (%s)",
    (_kind, books) => {
      const current = controller(books);
      render(<ImportScreen controller={current} onReview={vi.fn()} />);
      expect(screen.getByText(/账本管理.*切换.*可用账本/)).toBeTruthy();
      const button = screen.getByRole("button", {
        name: "使用我的账本导入",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(current.switchMode).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["local", { id: "personal", name: "个人账本" }],
    ["network", { id: "personal", name: "联网个人账本", cloud }],
  ] as [string, Book][])(
    "continues switching to a visible %s personal book",
    (_kind, personal) => {
      const current = controller([demo, personal]);
      render(<ImportScreen controller={current} onReview={vi.fn()} />);
      const button = screen.getByRole("button", {
        name: "使用我的账本导入",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      fireEvent.click(button);
      expect(current.switchMode).toHaveBeenCalledWith("personal");
    },
  );
});
