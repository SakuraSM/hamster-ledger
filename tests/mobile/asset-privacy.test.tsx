// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { AssetAccountDetail } from "../../apps/mobile/src/screens/AssetAccountDetail";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({
    colors: {
      onSurfaceVariant: "#555",
      surfaceVariant: "#eee",
      outlineVariant: "#ccc",
    },
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));
vi.mock("../../apps/mobile/src/screens/AccountRecordList", () => ({
  AccountRecordList: ({ isAmountHidden }: { isAmountHidden?: boolean }) => (
    <span>{isAmountHidden ? "金额已隐藏" : "账户流水金额 987.65"}</span>
  ),
}));
afterEach(cleanup);
it("keeps balances, credit limit and history hidden until the user reveals them", () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "privacy-card",
    name: "信用卡 8.88",
    aliases: ["别名 8.88"],
    kind: "liability" as const,
    type: "信用卡" as const,
    openingBalance: 123456,
    creditLimit: 456789,
    checkpoints: [],
    balanceAt: "2026-10-01 00:00:00",
  };
  const ledger = { ...example, records: [], accounts: [account] };
  const onReveal = vi.fn();
  const props = {
    account,
    ledger,
    through: "2026-11-06 23:59:59",
    isSaving: false,
    onReveal,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onCalibrate: vi.fn(),
    onTransfer: vi.fn(),
    onManageRates: vi.fn(),
    onArchive: vi.fn(),
    onRecord: vi.fn(),
  };
  const view = render(<AssetAccountDetail {...props} isAmountHidden />);
  fireEvent.click(screen.getByRole("button", { name: "余额基准与历史" }));
  expect(view.container.textContent).not.toContain("1,234.56");
  expect(view.container.textContent).not.toContain("4,567.89");
  expect(view.container.textContent).not.toContain("987.65");
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.textContent).not.toContain("+••••");
  expect(view.container.textContent).not.toContain("-••••");
  fireEvent.click(
    screen.getByRole("button", { name: "显示资产金额后查看历史" }),
  );
  expect(onReveal).toHaveBeenCalledOnce();
  view.rerender(<AssetAccountDetail {...props} isAmountHidden={false} />);
  expect(view.container.textContent).toContain("1,234.56");
  expect(view.container.textContent).toContain("4,567.89");
  expect(view.container.textContent).toContain("987.65");
});
