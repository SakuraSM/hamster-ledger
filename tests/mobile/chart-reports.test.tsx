// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { reportGroups, type BillRecord } from "@hamster-ledger/core";
import { ReportDistribution } from "../../apps/mobile/src/screens/ReportDistribution";
import { CashFlowChart } from "../../apps/mobile/src/screens/CashFlowChart";
import { ReportRecordList } from "../../apps/mobile/src/screens/ReportRecordList";

vi.mock("react-native", () => ({
  View: ({
    children,
    accessibilityLabel,
  }: {
    children: ReactNode;
    accessibilityLabel?: string;
  }) => <div aria-label={accessibilityLabel}>{children}</div>,
  Pressable: ({
    children,
    accessibilityLabel,
    onPress,
    accessibilityState,
  }: {
    children: ReactNode;
    accessibilityLabel?: string;
    onPress?: () => void;
    accessibilityState?: { selected?: boolean };
  }) => (
    <button
      aria-label={accessibilityLabel}
      aria-pressed={accessibilityState?.selected}
      onClick={onPress}
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
}));
vi.mock("react-native-svg", () => ({
  default: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Circle: () => <circle />,
  Path: ({ onPress }: { onPress?: () => void }) => <path onClick={onPress} />,
  Line: () => <line />,
  Rect: () => <rect />,
  Text: ({ children }: { children: ReactNode }) => <text>{children}</text>,
}));
vi.mock("react-native-paper", () => {
  const Container = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Card: Object.assign(Container, { Content: Container }),
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({
      children,
      onPress,
      accessibilityLabel,
      disabled,
    }: {
      children: ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
      disabled?: boolean;
    }) => (
      <button
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={onPress}
      >
        {children}
      </button>
    ),
    useTheme: () => ({
      dark: false,
      colors: {
        surface: "#fff",
        outlineVariant: "#ccc",
        onSurfaceVariant: "#444",
        outline: "#777",
      },
    }),
  };
});
const base = createDemoLedger().records[0];
const records: BillRecord[] = [
  {
    ...base,
    id: "food",
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
    id: "other",
    date: "2026-09-02 13:00:00",
    merchant: "示例交通",
    category: "交通",
    amount: 2000,
    kind: "支出",
    status: "confirmed",
  },
];
afterEach(cleanup);
it("shows the same distribution shares and opens a selected record", () => {
  const onRecord = vi.fn();
  const view = render(
    <ReportDistribution
      groups={reportGroups({ records, dimension: "category", kind: "支出" })}
      records={records}
      dimension="category"
      kind="支出"
      onRecord={onRecord}
    />,
  );
  const group = screen.getByRole("button", { name: /餐饮，80.0%/ });
  const segment = view.container.querySelector("path");
  if (!segment) throw new Error("分类扇区不存在");
  fireEvent.click(segment);
  expect(group.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "查看示例餐厅账单" }));
  expect(onRecord).toHaveBeenCalledWith(records[0]);
});
it("selects a period with accessible controls and reveals its actual records", () => {
  const onRecord = vi.fn();
  const view = render(
    <CashFlowChart
      records={records}
      start="2026-09-01"
      end="2026-09-03"
      onRecord={onRecord}
    />,
  );
  expect(screen.getByText("2026-09-03")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "查看上一期收支" }));
  expect(screen.getByText("2026-09-02")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /查看 2026-09-02 账单/ }));
  fireEvent.click(screen.getByRole("button", { name: "查看示例退款账单" }));
  expect(onRecord).toHaveBeenCalledWith(records[1]);
  expect(within(view.container).getByText(/净支出 ¥0.00/)).toBeTruthy();
});
it("can reach records beyond the first page of a chart drilldown", () => {
  const onRecord = vi.fn();
  const many = Array.from({ length: 9 }, (_, index) => ({
    ...records[0],
    id: `bill-${index}`,
    merchant: `商户 ${index}`,
  }));
  render(<ReportRecordList records={many} onRecord={onRecord} />);
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  fireEvent.click(screen.getByRole("button", { name: "查看商户 8账单" }));
  expect(onRecord).toHaveBeenCalledWith(many[8]);
});
