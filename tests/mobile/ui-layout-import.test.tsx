// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import { createStatement } from "@hamster-ledger/importers";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { ImportScreen } from "../../apps/mobile/src/screens/ImportScreen";
const { pickStatements, readStatement } = vi.hoisted(() => ({
  pickStatements: vi.fn(),
  readStatement: vi.fn(),
}));
vi.mock("../../apps/mobile/src/platform/files", () => ({
  pickStatements,
  readStatement,
  shareImportErrors: vi.fn(),
}));
vi.mock("../../apps/mobile/src/platform/storage", () => ({
  nativeStore: { getItem: async () => null, setItem: async () => undefined },
}));
vi.mock("../../apps/mobile/src/screens/StatementMapping", () => ({
  StatementMapping: () => <span>字段编辑</span>,
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useTheme: () => ({ dark: false, colors: { outlineVariant: "#ccc" } }),
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
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
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
    commit: vi.fn().mockResolvedValue(undefined),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
it("uses the native picker and imports real parsed records while masking preview amounts", async () => {
  const file = createStatement({
    name: "alipay 8.88.csv",
    hash: "import-test",
    rows: [
      ["交易时间", "交易对方", "金额", "收/支"],
      ["2026-10-01 12:00:00", "咖啡 8.88", "8.88", "支出"],
    ],
  });
  const asset = { name: file.name, uri: "file:///test.csv" };
  pickStatements.mockResolvedValue([asset]);
  readStatement.mockResolvedValue(file);
  const example = createDemoLedger();
  const ledger: Ledger = {
    ...example,
    records: [],
    files: [],
    reviews: [],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const controller = controllerFor(ledger);
  const view = render(
    <ImportScreen controller={controller} onReview={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "选择账单文件" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "确认导入" })).toBeTruthy(),
  );
  expect(pickStatements).toHaveBeenCalledOnce();
  expect(readStatement).toHaveBeenCalledWith(asset);
  expect(view.container.textContent).not.toContain("8.88");
  fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
  await waitFor(() => expect(controller.commit).toHaveBeenCalledOnce());
  const saved = vi.mocked(controller.commit).mock.calls[0][0];
  expect(saved.records[0].merchant).toBe("咖啡 8.88");
  expect(saved.records[0].amount).toBe(888);
});
