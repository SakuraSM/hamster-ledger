// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { NetWorthVisualization } from "../apps/web/src/components/planning/NetWorthVisualization";
const rows = [
  { date: "2026-01-01", amount: 100000, missing: [], missingBaselines: [] },
  {
    date: "2026-01-31",
    amount: null,
    missing: [],
    missingBaselines: ["私密账户"],
  },
  { date: "2026-02-28", amount: 150000, missing: [], missingBaselines: [] },
];
afterEach(cleanup);
it("selects a missing-baseline gap without displaying a partial or interpolated amount", () => {
  const view = render(
    <NetWorthVisualization rows={rows} isHidden={false} hasAccounts />,
  );
  expect(screen.getByText("¥1,500.00")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看上一期净资产" }));
  expect(screen.getByText("暂无估值")).toBeTruthy();
  expect(screen.getAllByText(/缺少余额基准：私密账户/).length).toBeGreaterThan(
    0,
  );
  view.rerender(<NetWorthVisualization rows={rows} isHidden hasAccounts />);
  expect(view.container.textContent).not.toContain("私密账户");
  expect(view.container.textContent).not.toContain("1,500.00");
});
it("does not show a zero net worth when there are no asset accounts", () => {
  render(
    <NetWorthVisualization
      rows={[{ date: "2026-02-28", amount: 0, missing: [] }]}
      isHidden={false}
      hasAccounts={false}
    />,
  );
  expect(screen.getByText(/添加账户并设置余额基准/)).toBeTruthy();
  expect(screen.queryByText("¥0.00")).toBeNull();
});
