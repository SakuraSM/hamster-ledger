// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import {
  DEFAULT_PREFERENCES,
  signedMoney,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { OverviewScreen } from "../../apps/mobile/src/screens/OverviewScreen";

interface ContainerProps {
  children: ReactNode;
}
vi.mock("react-native", () => ({
  DeviceEventEmitter: { addListener: () => ({ remove: () => undefined }) },
  View: ({ children }: ContainerProps) => <div>{children}</div>,
  useWindowDimensions: () => ({ fontScale: 1 }),
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
}));
vi.mock("react-native-paper", () => {
  const container = ({ children }: ContainerProps) => <div>{children}</div>;
  return {
    Card: Object.assign(container, { Content: container }),
    Text: ({ children }: ContainerProps) => <span>{children}</span>,
    Button: ({ children }: ContainerProps) => <button>{children}</button>,
    ProgressBar: () => null,
    useTheme: () => ({ dark: false, colors: { onSurfaceVariant: "#777777" } }),
  };
});
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: ContainerProps) => <main>{children}</main>,
  Section: ({ title, children }: ContainerProps & { title: string }) => (
    <section aria-label={title}>{children}</section>
  ),
  styles: { row: {} },
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({ label, value }: { label: string; value: string }) => (
    <button>
      {label}：{value}
    </button>
  ),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-12 12:00:00",
}));
vi.mock("../../apps/mobile/src/screens/RecordRow", () => ({
  RecordRow: ({ record }: { record: BillRecord }) => (
    <button aria-label={`${record.merchant}，${signedMoney(record)}`}>
      {record.merchant} {signedMoney(record)}
    </button>
  ),
}));
afterEach(cleanup);

function book(isAmountHidden: boolean): Ledger {
  const ledger = createDemoLedger();
  return {
    ...ledger,
    records: [
      {
        ...ledger.records[0],
        merchant: "PLAN-AI 8.88",
        date: "2026-10-12 12:00:00",
        amount: 888,
        kind: "支出",
        category: "餐饮",
        status: "confirmed",
      },
    ],
    reviews: [],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: isAmountHidden },
  };
}
function overview(ledger: Ledger): React.JSX.Element {
  return (
    <OverviewScreen
      ledger={ledger}
      month="2026-10"
      onMonth={vi.fn()}
      isDemo={false}
      onRecord={vi.fn()}
      onReview={vi.fn()}
    />
  );
}
describe("native homepage amount privacy", () => {
  it("masks totals and removes amount-bearing recent text from sight and accessibility", () => {
    const { container } = render(overview(book(true)));
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
    expect(screen.getByText("金额已隐藏，可前往账单页查看明细。")).toBeTruthy();
    expect(container.textContent).not.toContain("¥");
    expect(container.textContent).not.toContain("8.88");
    expect(screen.queryByRole("button", { name: /PLAN-AI/ })).toBeNull();
    expect(container.querySelector('[aria-label*="¥"]')).toBeNull();
  });
  it("keeps recent bill details available when privacy is disabled", () => {
    render(overview(book(false)));
    expect(screen.getByRole("button", { name: /PLAN-AI 8.88/ })).toBeTruthy();
    expect(screen.queryByText("金额已隐藏，可前往账单页查看明细。")).toBeNull();
  });
  it("restores the same amounts after toggling privacy without changing ledger data", () => {
    const ledger = book(false),
      view = render(overview(ledger));
    view.rerender(
      overview({
        ...ledger,
        preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
      }),
    );
    expect(screen.queryByRole("button", { name: /PLAN-AI/ })).toBeNull();
    view.rerender(overview(ledger));
    expect(
      screen
        .getByRole("button", { name: /PLAN-AI 8.88/ })
        .getAttribute("aria-label"),
    ).toContain("8.88");
    expect(ledger.records[0].amount).toBe(888);
  });
});
