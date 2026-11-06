// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES, type Ledger } from "@hamster-ledger/core";
import { ReportsScreen } from "../../apps/mobile/src/screens/ReportsScreen";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ProgressBar: () => <span>金额图表</span>,
  SegmentedButtons: () => <span>报表筛选</span>,
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  useAmountColors: () => ({ income: "#444", expense: "#444", neutral: "#444" }),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));
vi.mock("../../apps/mobile/src/ui/ReportRangePresets", () => ({
  ReportRangePresets: () => null,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => null,
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-12 12:00:00",
}));
vi.mock("../../apps/mobile/src/screens/NetWorthReport", () => ({
  NetWorthReport: () => <span>图表金额 8.88</span>,
}));
vi.mock("../../apps/mobile/src/screens/ExtendedReports", () => ({
  ExtendedReports: () => <span>明细金额 8.88</span>,
}));
afterEach(cleanup);
it("hides report totals, amount charts and detail lists while retaining range controls", () => {
  const example = createDemoLedger();
  const ledger: Ledger = {
    ...example,
    records: [
      {
        ...example.records[0],
        merchant: "商户 8.88",
        amount: 888,
        date: "2026-10-12 10:00:00",
        status: "confirmed",
        kind: "支出",
      },
    ],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
  };
  const view = render(<ReportsScreen ledger={ledger} />);
  expect(view.container.textContent).not.toContain("8.88");
  expect(screen.queryByText("金额图表")).toBeNull();
  expect(screen.getByText(/金额已隐藏/)).toBeTruthy();
  expect(screen.getAllByText("报表筛选").length).toBeGreaterThan(0);
});
