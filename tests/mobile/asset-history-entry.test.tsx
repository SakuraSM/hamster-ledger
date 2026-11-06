// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { AccountRecordList } from "../../apps/mobile/src/screens/AccountRecordList";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({ colors: { outlineVariant: "#ccc" } }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    mode,
  }: {
    children: ReactNode;
    onPress: () => void;
    mode?: string;
  }) => (
    <button onClick={onPress} aria-pressed={mode === "contained"}>
      {children}
    </button>
  ),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({ styles: { row: {} } }));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: () => null,
}));
vi.mock("../../apps/mobile/src/screens/RecordRow", () => ({
  RecordRow: ({
    record,
    isAmountHidden,
  }: {
    record: { merchant: string };
    isAmountHidden?: boolean;
  }) => <span>{isAmountHidden ? "金额已隐藏" : record.merchant}</span>,
}));
afterEach(cleanup);
it("opens the real history hook directly on the selected account's original records", () => {
  const example = createDemoLedger();
  const account = example.accounts[0];
  const record = {
    ...example.records[0],
    id: "linked",
    merchant: "本账户关联账单",
    accountId: account.id,
    status: "confirmed" as const,
    isDeleted: false,
    date: "2026-10-01 12:00:00",
  };
  const other = {
    ...record,
    id: "other",
    merchant: "其他账户账单",
    accountId: "other-account",
  };
  render(
    <AccountRecordList
      ledger={{ ...example, records: [record, other] }}
      account={account}
      through="2026-11-06 23:59:59"
      initialMode="records"
      onRecord={vi.fn()}
    />,
  );
  expect(
    screen
      .getByRole("button", { name: "关联账单" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByText("本账户关联账单")).toBeTruthy();
  expect(screen.queryByText("其他账户账单")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "余额变动" }));
  expect(
    screen
      .getByRole("button", { name: "余额变动" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});
it("masks the linked record list while amounts are hidden", () => {
  const example = createDemoLedger();
  const account = example.accounts[0];
  const record = {
    ...example.records[0],
    merchant: "咖啡 8.88",
    amount: 888,
    accountId: account.id,
  };
  const view = render(
    <AccountRecordList
      ledger={{ ...example, records: [record] }}
      account={account}
      through="2026-11-06 23:59:59"
      initialMode="records"
      isAmountHidden
      onRecord={vi.fn()}
    />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(screen.getByText("金额已隐藏")).toBeTruthy();
});
