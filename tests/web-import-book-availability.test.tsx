// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import { EMPTY_LEDGER, type Book, type Ledger } from "@hamster-ledger/core";
import { createStatement } from "@hamster-ledger/importers";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { CloudController } from "../apps/web/src/hooks/cloud-controller";
import { AppPages } from "../apps/web/src/components/AppPages";
const { readStatement } = vi.hoisted(() => ({ readStatement: vi.fn() }));
vi.mock("../apps/web/src/platform/browser/files", () => ({ readStatement }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const cloud = {
  id: "remote",
  userId: "owner",
  server: "https://test",
  role: "owner" as const,
};
const demo: Book = { id: "demo", name: "示例账本" };
const sync: CloudController = {
  user: null,
  books: [],
  isBusy: false,
  message: "",
  error: "",
  preview: null,
  isLinked: false,
  authenticate: async () => {},
  logout: async () => {},
  upload: async () => {},
  sync: async () => {},
  inspect: async () => {},
  restore: async () => {},
  dismissPreview: vi.fn(),
  disconnect: async () => {},
};
function controller(
  books: Book[],
  personalLedger: Ledger = EMPTY_LEDGER,
): LedgerController {
  return {
    books,
    ledger: EMPTY_LEDGER,
    personalLedger,
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
function renderPage(
  current: LedgerController,
  onNavigate = vi.fn(),
  onImport = vi.fn(),
) {
  const view = render(
    <AppPages
      controller={current}
      sync={sync}
      page="import"
      month="2026-10"
      recordMonth=""
      onRecordMonth={vi.fn()}
      filter={{ source: "", category: "" }}
      onFilter={vi.fn()}
      onMonth={vi.fn()}
      onNavigate={onNavigate}
      onSelect={vi.fn()}
      onPreview={vi.fn()}
      onCategory={vi.fn()}
      onUnassigned={vi.fn()}
      onImport={onImport}
      onAdd={vi.fn()}
    />,
  );
  return { ...view, onNavigate, onImport };
}
describe("Web demo import destination", () => {
  it.each([
    ["hidden", [demo]],
    ["network", [demo, { id: "personal", name: "联网个人账本", cloud }]],
    [
      "archived",
      [demo, { id: "personal", name: "个人账本", isArchived: true }],
    ],
  ] as [string, Book[]][])(
    "requires choosing an available book when personal is %s",
    (_kind, books) => {
      const { onNavigate, onImport } = renderPage(controller(books));
      expect(screen.queryByRole("button", { name: "选择账单文件" })).toBeNull();
      expect(screen.getByText(/切换到可用账本/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "进入账本管理" }));
      expect(onNavigate).toHaveBeenCalledWith("tools");
      expect(onImport).not.toHaveBeenCalled();
    },
  );
  it("uses the actual local personal ledger for duplicate detection", async () => {
    const statement = createStatement({
      name: "账单.csv",
      hash: "already-present",
      rows: [
        ["交易时间", "交易对方", "金额", "收/支"],
        ["2026-10-01 12:00:00", "咖啡", "8.88", "支出"],
      ],
    });
    readStatement.mockResolvedValue(statement);
    const personal = {
      ...EMPTY_LEDGER,
      files: [{ hash: "already-present", name: "旧账单.csv" }],
    };
    const { container, onImport } = renderPage(
      controller([demo, { id: "personal", name: "本机个人账本" }], personal),
    );
    expect(screen.getByText(/导入到本机个人账本/)).toBeTruthy();
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("缺少文件选择入口");
    fireEvent.change(fileInput, {
      target: { files: [new File(["x"], "账单.csv", { type: "text/csv" })] },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/已导入/),
    );
    expect(onImport).not.toHaveBeenCalled();
  });
  it("keeps importing into an explicitly selected online book", () => {
    const current = controller([
      { id: "book:online", name: "家庭账本", cloud },
    ]);
    current.mode = "book:online";
    renderPage(current);
    expect(screen.getByText(/导入到家庭账本/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "选择账单文件" })).toBeTruthy();
  });
});
