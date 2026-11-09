// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "./helpers/render";
import {
  DEFAULT_PREFERENCES,
  EMPTY_LEDGER,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { ReportsPage } from "../apps/web/src/components/planning/ReportsPage";
const { client } = vi.hoisted(() => ({ client: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => client,
}));
afterEach(cleanup);
const record: BillRecord = {
  id: "bill",
  date: "2026-10-05 12:00:00",
  merchant: "商户",
  description: "",
  amount: 12345,
  currency: "CNY",
  kind: "支出",
  category: "子分类 456.78",
  source: "手动记账",
  account: "",
  accountId: null,
  orderId: "",
  status: "confirmed",
  sourceStatus: "成功",
  fileName: "",
  raw: {},
  linkedSources: [],
  tags: ["标签 987.65"],
  detail: {
    type: "expense",
    original: {
      currency: "CNY",
      minor: 12345,
      rate: "1",
      date: "2026-10-05",
      source: "manual",
    },
    memberId: "成员 22.22",
    splits: [],
    movements: [],
    attachmentIds: [],
    origin: "manual",
  },
};
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  records: [record],
  categories: [
    { id: "parent-id", name: "父分类 123.45", kind: "支出", order: 100 },
    {
      id: "child-id",
      name: "子分类 456.78",
      kind: "支出",
      order: 101,
      parentId: "parent-id",
    },
  ],
  preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
};
function assertSensitiveTextAbsent(): void {
  for (const value of [
    "父分类 123.45",
    "子分类 456.78",
    "标签 987.65",
    "成员 22.22",
  ]) {
    expect(document.body.innerHTML).not.toContain(value);
  }
}
it("keeps the selected range visible and opens custom date controls on request", () => {
  render(<ReportsPage ledger={ledger} month="2026-10" />);
  expect(screen.queryByLabelText(/开始日期/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "全年" }));
  const toggle = screen.getByRole("button", {
    name: /2026-01-01 至 2026-12-31 · 自定义日期/,
  });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByLabelText(/开始日期/)).toBeTruthy();
  expect(screen.getByLabelText(/结束日期/)).toBeTruthy();
});
it("masks custom category and member names in DOM and accessibility while preserving category drilldown", () => {
  const view = render(<ReportsPage ledger={ledger} month="2026-10" />);
  assertSensitiveTextAbsent();
  const heading = screen.getByRole("heading", { name: "分类层级" });
  const section = heading.closest("section");
  if (!section) throw new Error("分类区域不存在");
  const drill = within(section).getByRole("button", {
    name: "分类 1 · 查看子分类",
  });
  drill.focus();
  expect(document.activeElement).toBe(drill);
  expect(drill.tagName).toBe("BUTTON");
  fireEvent.click(drill);
  expect(within(section).getByText("分类 1")).toBeTruthy();
  assertSensitiveTextAbsent();
  view.rerender(
    <ReportsPage
      ledger={{
        ...ledger,
        preferences: { ...DEFAULT_PREFERENCES, hideAmounts: false },
      }}
      month="2026-10"
    />,
  );
  expect(within(section).getByText("子分类 456.78")).toBeTruthy();
});
it("masks custom tags until privacy is disabled", () => {
  const view = render(<ReportsPage ledger={ledger} month="2026-10" />);
  fireEvent.click(screen.getByRole("combobox", { name: "统计维度" }));
  fireEvent.click(screen.getByRole("option", { name: "标签" }));
  assertSensitiveTextAbsent();
  expect(screen.getByText("标签 1")).toBeTruthy();
  view.rerender(
    <ReportsPage
      ledger={{
        ...ledger,
        preferences: { ...DEFAULT_PREFERENCES, hideAmounts: false },
      }}
      month="2026-10"
    />,
  );
  expect(screen.getByText("标签 987.65")).toBeTruthy();
});
