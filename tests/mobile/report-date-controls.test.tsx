// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportDateControls } from "../../apps/mobile/src/ui/ReportDateControls";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    accessibilityState,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityState?: { expanded?: boolean };
  }) => (
    <button aria-expanded={accessibilityState?.expanded} onClick={onPress}>
      {children}
    </button>
  ),
}));
vi.mock("../../apps/mobile/src/ui/ReportRangePresets", () => ({
  ReportRangePresets: () => null,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
}));
afterEach(cleanup);
it("reveals custom dates and keeps the other endpoint when editing", () => {
  const onChange = vi.fn();
  render(
    <ReportDateControls
      today="2026-11-09"
      start="2026-09-01"
      end="2026-09-30"
      onChange={onChange}
    />,
  );
  const toggle = screen.getByRole("button", { name: "自定义日期" });
  expect(screen.queryByLabelText("开始日期")).toBeNull();
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.change(screen.getByLabelText("开始日期"), {
    target: { value: "2026-09-02" },
  });
  expect(onChange).toHaveBeenCalledWith("2026-09-02", "2026-09-30");
});
