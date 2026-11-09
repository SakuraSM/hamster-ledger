// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "./helpers/render";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { reportGroups, type BillRecord } from "@hamster-ledger/core";
import { ReportDistribution } from "../apps/web/src/components/planning/ReportDistribution";
import { CashFlowChart } from "../apps/web/src/components/planning/CashFlowChart";
import { ReportRecordList } from "../apps/web/src/components/planning/ReportRecordList";

const base = createDemoLedger().records[0];
const records: BillRecord[] = [
  {
    ...base,
    id: "meal",
    date: "2026-09-01 12:00:00",
    merchant: "示例餐厅",
    category: "餐饮",
    amount: 10000,
    kind: "支出",
    status: "confirmed",
  },
  {
    ...base,
    id: "refund",
    date: "2026-09-02 12:00:00",
    merchant: "示例退款",
    category: "餐饮",
    amount: 2000,
    kind: "退款",
    status: "confirmed",
  },
  {
    ...base,
    id: "taxi",
    date: "2026-09-02 13:00:00",
    merchant: "示例交通",
    category: "交通",
    amount: 2000,
    kind: "支出",
    status: "confirmed",
  },
  {
    ...base,
    id: "pending",
    date: "2026-09-03 12:00:00",
    merchant: "待确认",
    category: "餐饮",
    amount: 90000,
    kind: "支出",
    status: "pending",
  },
];
afterEach(cleanup);
it("shows true category shares and opens the matching confirmed records", () => {
  const onRecord = vi.fn();
  const groups = reportGroups({ records, dimension: "category", kind: "支出" });
  const view = render(
    <ReportDistribution
      groups={groups}
      records={records}
      dimension="category"
      kind="支出"
      isHidden={false}
      onRecord={onRecord}
    />,
  );
  const group = screen.getByRole("button", { name: /餐饮/ });
  expect(group.textContent).toContain("80.0%");
  fireEvent.click(group);
  const details = screen.getByLabelText("餐饮账单明细");
  expect(details.textContent).toContain("示例餐厅");
  expect(details.textContent).toContain("示例退款");
  expect(details.textContent).not.toContain("待确认");
  fireEvent.click(within(details).getByRole("button", { name: /示例餐厅/ }));
  expect(onRecord).toHaveBeenCalledWith(records[0]);
  view.rerender(
    <ReportDistribution
      groups={groups}
      records={records}
      dimension="category"
      kind="支出"
      isHidden
      onRecord={onRecord}
    />,
  );
  expect(view.container.textContent).not.toContain("餐饮");
  expect(view.container.textContent).not.toContain("示例餐厅");
  expect(view.container.textContent).not.toContain("80.0%");
});
it("allows keyboard-accessible period selection, including zero days and negative net expense", () => {
  render(
    <CashFlowChart
      records={records}
      start="2026-09-01"
      end="2026-09-03"
      isHidden={false}
    />,
  );
  expect(screen.getByText("2026-09-03")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看上一期收支" }));
  expect(screen.getByText("2026-09-02")).toBeTruthy();
  expect(screen.getByText(/净支出 ¥0.00/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看上一期收支" }));
  expect(screen.getByText("2026-09-01")).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "查看上一期收支" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("does not fabricate a truncated trend for ranges longer than ten years", () => {
  render(
    <CashFlowChart
      records={[]}
      start="2000-01-01"
      end="2020-01-01"
      isHidden={false}
    />,
  );
  expect(screen.getByText(/超过 120 个自然月/)).toBeTruthy();
  expect(screen.queryByRole("group", { name: /收支趋势/ })).toBeNull();
});
it("pages through all matching records rather than silently truncating the drilldown", () => {
  const onRecord = vi.fn();
  const many = Array.from({ length: 9 }, (_, index) => ({
    ...records[0],
    id: `bill-${index}`,
    merchant: `商户 ${index}`,
  }));
  render(<ReportRecordList records={many} onRecord={onRecord} />);
  expect(screen.queryByText("商户 8")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  fireEvent.click(screen.getByRole("button", { name: /商户 8/ }));
  expect(onRecord).toHaveBeenCalledWith(many[8]);
});
