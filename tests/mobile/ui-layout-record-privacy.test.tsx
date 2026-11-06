// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { RecordRow } from "../../apps/mobile/src/screens/RecordRow";

vi.mock("react-native-paper", () => ({
  List: {
    Item: ({
      title,
      description,
      accessibilityLabel,
      onPress,
      right,
    }: {
      title: string;
      description: string;
      accessibilityLabel: string;
      onPress: () => void;
      right: () => ReactNode;
    }) => (
      <button aria-label={accessibilityLabel} onClick={onPress}>
        {title} {description} {right()}
      </button>
    ),
    Icon: () => null,
  },
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  useAmountColors: () => ({ income: "#444", expense: "#444", neutral: "#444" }),
}));
afterEach(cleanup);
it("masks a list row and its accessibility name while retaining the record action", () => {
  const record = {
    ...createDemoLedger().records[0],
    merchant: "咖啡 8.88",
    amount: 888,
  };
  const onPress = vi.fn();
  const view = render(
    <RecordRow record={record} onPress={onPress} isAmountHidden />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /金额已隐藏/ }));
  expect(onPress).toHaveBeenCalledWith(record);
  view.rerender(
    <RecordRow record={record} onPress={onPress} isAmountHidden={false} />,
  );
  expect(view.container.textContent).toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).not.toBeNull();
});

it("announces a deleted record as being in the recycle bin", () => {
  const record = {
    ...createDemoLedger().records[0],
    isDeleted: true,
    status: "confirmed" as const,
  };
  render(<RecordRow record={record} onPress={vi.fn()} isAmountHidden />);
  expect(screen.getByRole("button", { name: /回收站/ })).toBeTruthy();
});
