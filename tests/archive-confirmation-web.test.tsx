// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./helpers/render";
import { EMPTY_LEDGER, type Book, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { CategoriesPanel } from "../apps/web/src/components/settings/CategoriesPanel";
import { BooksPanel } from "../apps/web/src/components/settings/BooksPanel";

afterEach(cleanup);
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  records: [
    {
      id: "history",
      date: "2026-10-01 12:00:00",
      merchant: "虚拟商户",
      description: "历史账单",
      amount: 2000,
      currency: "CNY",
      kind: "支出",
      category: "出差",
      source: "手动记账",
      account: "",
      orderId: "",
      status: "confirmed",
      sourceStatus: "已确认",
      fileName: "manual",
      raw: {},
      linkedSources: [],
    },
  ],
  categories: [
    { id: "office", name: "办公", kind: "支出", order: 20 },
    { id: "travel", name: "出差", kind: "支出", order: 21 },
  ],
};
const books: Book[] = [
  { id: "personal", name: "个人账" },
  { id: "book:office", name: "办公账" },
  { id: "book:travel", name: "旅行账" },
];
function rowFor(text: string): HTMLElement {
  const row = screen.getByText(text).parentElement;
  if (!row) throw new Error("Missing row");
  return row;
}
function controller(
  updateBooks: LedgerController["updateBooks"],
): LedgerController {
  return {
    books,
    mode: "personal",
    ledger,
    personalLedger: ledger,
    updateBooks,
    createBook: async () => "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    switchMode: vi.fn(),
    commit: async () => {},
    decide: () => {},
    undo: () => {},
    editRecord: async () => {},
    dismissNotice: () => {},
    notify: () => {},
  };
}

describe("archive confirmation on Web", () => {
  it("confirms the selected category, preserves history and calls commit once", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(
      () => new Promise<void>(() => {}),
    );
    render(<CategoriesPanel ledger={ledger} onCommit={commit} />);
    fireEvent.click(
      within(rowFor("出差 · 支出")).getByRole("button", { name: "归档" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/出差/)).toBeTruthy();
    expect(within(dialog).getByText(/历史/)).toBeTruthy();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(commit).not.toHaveBeenCalled();

    fireEvent.click(
      within(rowFor("出差 · 支出")).getByRole("button", { name: "归档" }),
    );
    const nextDialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(nextDialog).getByRole("button", { name: "确认归档" }),
    );
    fireEvent.click(
      within(nextDialog).getByRole("button", { name: "确认归档" }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
    const saved = commit.mock.calls[0][0] as Ledger;
    expect(
      saved.categories?.find((category) => category.id === "travel")
        ?.isArchived,
    ).toBe(true);
    expect(
      saved.categories?.find((category) => category.id === "office")
        ?.isArchived,
    ).not.toBe(true);
    expect(saved.records).toEqual(ledger.records);
  });

  it("keeps the category confirmation open and shows write failures", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(async () => {
      throw new Error("只读账本");
    });
    render(<CategoriesPanel ledger={ledger} onCommit={commit} />);
    fireEvent.click(
      within(rowFor("办公 · 支出")).getByRole("button", { name: "归档" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认归档" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "只读账本",
      ),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("restores an archived category without rewriting its historical bill", async () => {
    const archived = {
      ...ledger,
      categories: ledger.categories?.map((item) =>
        item.id === "travel" ? { ...item, isArchived: true } : item,
      ),
    };
    const commit = vi.fn<(next: Ledger) => Promise<void>>(async () => {});
    render(<CategoriesPanel ledger={archived} onCommit={commit} />);
    fireEvent.click(
      within(rowFor("出差 · 支出 · 已归档")).getByRole("button", {
        name: "恢复",
      }),
    );
    await waitFor(() => expect(commit).toHaveBeenCalledOnce());
    expect(commit.mock.calls[0][0].records).toEqual(ledger.records);
    expect(
      commit.mock.calls[0][0].categories?.find((item) => item.id === "travel")
        ?.isArchived,
    ).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not archive a different category after the target changes", async () => {
    const commit = vi.fn<(next: Ledger) => Promise<void>>(async () => {});
    const view = render(<CategoriesPanel ledger={ledger} onCommit={commit} />);
    fireEvent.click(
      within(rowFor("出差 · 支出")).getByRole("button", { name: "归档" }),
    );
    const dialog = await screen.findByRole("dialog");
    const changed = {
      ...ledger,
      categories: ledger.categories?.map((item) =>
        item.id === "travel" ? { ...item, name: "工作差旅" } : item,
      ),
    };
    view.rerender(<CategoriesPanel ledger={changed} onCommit={commit} />);
    fireEvent.click(within(dialog).getByRole("button", { name: "确认归档" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "重新确认",
      ),
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it("confirms the selected book before archiving and keeps other books unchanged", async () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(
      () => new Promise<void>(() => {}),
    );
    render(<BooksPanel controller={controller(updateBooks)} />);
    fireEvent.click(
      within(rowFor("旅行账")).getByRole("button", { name: "归档" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/旅行账/)).toBeTruthy();
    expect(within(dialog).getByText(/历史|账单/)).toBeTruthy();
    expect(updateBooks).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(updateBooks).not.toHaveBeenCalled();
    fireEvent.click(
      within(rowFor("旅行账")).getByRole("button", { name: "归档" }),
    );
    const nextDialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(nextDialog).getByRole("button", { name: "确认归档" }),
    );
    fireEvent.click(
      within(nextDialog).getByRole("button", { name: "确认归档" }),
    );
    expect(updateBooks).toHaveBeenCalledTimes(1);
    expect(updateBooks.mock.calls[0][0]).toEqual([
      books[0],
      books[1],
      { ...books[2], isArchived: true },
    ]);
  });

  it("leaves archived books restorable without affecting another book", async () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(async () => {});
    const archived = books.map((book) =>
      book.id === "book:travel" ? { ...book, isArchived: true } : book,
    );
    render(
      <BooksPanel
        controller={{ ...controller(updateBooks), books: archived }}
      />,
    );
    fireEvent.click(
      within(rowFor("旅行账 · 已归档")).getByRole("button", { name: "恢复" }),
    );
    await waitFor(() => expect(updateBooks).toHaveBeenCalledTimes(1));
    expect(updateBooks.mock.calls[0][0][2]).toEqual({
      ...books[2],
      isArchived: false,
    });
  });

  it("keeps a book confirmation open if the write fails", async () => {
    const updateBooks = vi.fn<(next: Book[]) => Promise<void>>(async () => {
      throw new Error("保存失败");
    });
    render(<BooksPanel controller={controller(updateBooks)} />);
    fireEvent.click(
      within(rowFor("办公账")).getByRole("button", { name: "归档" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认归档" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toContain(
        "保存失败",
      ),
    );
    expect(updateBooks).toHaveBeenCalledOnce();
  });
});
