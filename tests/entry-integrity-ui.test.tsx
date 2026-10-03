// @vitest-environment jsdom
import { beforeAll, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "./helpers/render";
import {
  EMPTY_LEDGER,
  saveEntry,
  saveCategory,
  saveBudget,
  budgetProgress,
  type Ledger,
  type EntryInput,
} from "@hamster-ledger/core";
import { EntryEditor } from "../apps/web/src/components/EntryEditor";
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(cleanup);
const entry: EntryInput = {
  id: "bill",
  date: "2026-09-20 12:00:00",
  merchant: "合成午餐",
  amount: 10000,
  kind: "支出",
  category: "餐饮",
  description: "初始备注",
  tags: [],
  accountId: null,
  transferToAccountId: null,
};
it("uses a renamed default category for a new bill and deducts its category budget", async () => {
  let ledger = saveCategory(EMPTY_LEDGER, {
    id: "builtin:餐饮",
    name: "吃饭",
    kind: "支出",
    order: 1,
  });
  ledger = saveBudget(ledger, {
    id: "budget",
    month: "2026-09",
    category: "吃饭",
    amount: 10000,
  });
  let saved: Ledger | undefined;
  render(
    <EntryEditor
      ledger={ledger}
      date="2026-09-20"
      onClose={() => {}}
      onSave={async (input) => {
        saved = saveEntry(ledger, input);
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "金额（元）" }), {
    target: { value: "42" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "商户 / 交易名称" }), {
    target: { value: "新午餐" },
  });
  await act(async () => fireEvent.click(screen.getByText("保存账单")));
  expect(saved?.records[0].category).toBe("吃饭");
  expect(saved && budgetProgress(saved, "2026-09")[0].spent).toBe(4200);
});
it("keeps the remote amount and the local draft when saving a stale open editor", async () => {
  const initial = saveEntry(EMPTY_LEDGER, entry);
  const remote = saveEntry(initial, { ...entry, amount: 20000 });
  let persisted = remote;
  const close = vi.fn();
  const view = render(
    <EntryEditor
      ledger={initial}
      record={initial.records[0]}
      onClose={close}
      onSave={async (input) => {
        persisted = saveEntry(initial, input);
      }}
    />,
  );
  view.rerender(
    <EntryEditor
      ledger={remote}
      record={initial.records[0]}
      onClose={close}
      onSave={async (input) => {
        persisted = saveEntry(remote, input);
      }}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "备注" }), {
    target: { value: "本机草稿" },
  });
  await act(async () => fireEvent.click(screen.getByText("保存账单")));
  expect(persisted.records[0].amount).toBe(20000);
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("已发生变化");
  expect(
    (screen.getByRole("combobox", { name: "备注" }) as HTMLInputElement).value,
  ).toBe("本机草稿");
});
it("does not reinsert an archived default category for a new bill", () => {
  const ledger = saveCategory(EMPTY_LEDGER, {
    id: "builtin:餐饮",
    name: "餐饮",
    kind: "支出",
    order: 1,
    isArchived: true,
  });
  render(
    <EntryEditor ledger={ledger} onClose={() => {}} onSave={async () => {}} />,
  );
  const select = screen.getByRole("combobox", {
    name: "分类",
  }) as HTMLInputElement;
  fireEvent.click(select);
  expect(screen.queryByRole("option", { name: "餐饮" })).toBeNull();
  expect(select.value).not.toBe("餐饮");
});
