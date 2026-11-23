// @vitest-environment jsdom
import type { ReactNode } from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EntryKeypad } from "../../apps/mobile/src/screens/EntryKeypad";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
afterEach(cleanup);
it("applies the arithmetic result to the draft once Done is pressed", () => {
  const apply = vi.fn();
  render(
    <EntryKeypad
      initial="0.10"
      category="餐饮"
      onApply={apply}
      onClose={vi.fn()}
    />,
  );
  for (const name of ["＋", ".", "2"])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "完成" }));
  expect(apply).toHaveBeenCalledWith("0.30");
});
it("keeps an invalid negative result in the keypad", () => {
  const apply = vi.fn();
  render(
    <EntryKeypad
      initial="1"
      category="餐饮"
      onApply={apply}
      onClose={vi.fn()}
    />,
  );
  for (const name of ["−", "2", "完成"])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByText("请填写大于零的金额。")).toBeTruthy();
});
