// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_LEDGER } from "@hamster-ledger/core";
import { AssetTrendPanel } from "../../apps/mobile/src/screens/AssetTrendPanel";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
}));
vi.mock("react-native-paper", () => ({
  Button: ({
    children,
    onPress,
    accessibilityState,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityState?: { selected?: boolean };
  }) => (
    <button aria-pressed={accessibilityState?.selected} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("../../apps/mobile/src/screens/NetWorthReport", () => ({
  NetWorthReport: ({ start, end }: { start: string; end: string }) => (
    <span>
      {start} 至 {end}
    </span>
  ),
}));
afterEach(cleanup);
it("switches the asset trend between calendar-month ranges", () => {
  render(<AssetTrendPanel ledger={EMPTY_LEDGER} end="2026-11-09" />);
  expect(screen.getByText("2026-06-01 至 2026-11-09")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "1 年" }));
  expect(screen.getByText("2025-12-01 至 2026-11-09")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "1 年" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "3 月" }));
  expect(screen.getByText("2026-09-01 至 2026-11-09")).toBeTruthy();
});
