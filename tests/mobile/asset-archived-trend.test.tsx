// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { archiveAssetAccount, type Ledger } from "@hamster-ledger/core";
import { NetWorthReport } from "../../apps/mobile/src/screens/NetWorthReport";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
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
    }: {
      children: ReactNode;
      onPress: () => void;
    }) => <button onClick={onPress}>{children}</button>,
    useTheme: () => ({
      dark: false,
      colors: {
        surface: "#fff",
        outlineVariant: "#ccc",
        onSurfaceVariant: "#555",
      },
    }),
  };
});
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client: { request: vi.fn() } }),
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("../../apps/mobile/src/ui/NetWorthChart", () => ({
  NetWorthChart: ({
    rows,
  }: {
    rows: Array<{ date: string; amount: number | null }>;
  }) => (
    <span>图表 {rows.map((row) => `${row.date}=${row.amount}`).join(";")}</span>
  ),
}));
afterEach(cleanup);
function archivedLedger(): Ledger {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archived",
    name: "已归档账户",
    currency: "CNY" as const,
    openingBalance: 100000,
    balanceAt: "2026-09-01 00:00:00",
    aliases: [],
    checkpoints: [],
    isArchived: false,
  };
  return archiveAssetAccount({
    ledger: { ...example, records: [], accounts: [account] },
    accountId: account.id,
    isArchived: true,
    at: "2026-10-15 12:00:00",
  });
}
it("shows the real earlier net-worth history after the last account is archived", () => {
  render(
    <NetWorthReport
      ledger={archivedLedger()}
      start="2026-09-01"
      end="2026-11-06"
    />,
  );
  expect(screen.getByText(/图表 .*2026-09-01=100000/)).toBeTruthy();
  expect(screen.getByText(/按各日账户状态/)).toBeTruthy();
  expect(screen.queryByText(/不含归档账户/)).toBeNull();
  expect(
    screen.queryByText("添加资产账户并设置余额后，即可查看净资产趋势。"),
  ).toBeNull();
});
it("does not show a fabricated trend for a range entirely after archive", () => {
  render(
    <NetWorthReport
      ledger={archivedLedger()}
      start="2026-11-01"
      end="2026-11-06"
    />,
  );
  expect(screen.getByText(/此范围内没有可用的账户余额基准/)).toBeTruthy();
  expect(screen.queryByText(/图表 /)).toBeNull();
});
