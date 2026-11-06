// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { summarizeAssets, type AssetAccount } from "@hamster-ledger/core";
import { AssetSummary } from "../../apps/mobile/src/screens/AssetSummary";
import { AssetSnapshot } from "../../apps/mobile/src/screens/AssetSnapshot";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  Card: Object.assign(
    ({ children }: { children: ReactNode }) => <div>{children}</div>,
    {
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Actions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    },
  ),
  useTheme: () => ({
    colors: { onSurfaceVariant: "#555", outlineVariant: "#ccc" },
  }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  IconButton: ({ accessibilityLabel }: { accessibilityLabel: string }) => (
    <button aria-label={accessibilityLabel} />
  ),
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client: stableClient }),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-11-06 12:00:00",
}));
const stableClient = { request: vi.fn() };
afterEach(cleanup);
const base = createDemoLedger().accounts[0];
const through = "2026-11-06 23:59:59";
function renderSummary(accounts: AssetAccount[]) {
  const ledger = { ...createDemoLedger(), accounts, records: [] };
  const totals = summarizeAssets({ ledger, through });
  return render(
    <AssetSummary
      valuationDate="2026-11-06"
      totals={totals}
      comparison={{
        previousDate: "2026-10-31",
        netChange: null,
        unavailableAccounts: [],
        accountChanges: {},
      }}
      isAmountHidden={false}
      onShowValuation={vi.fn()}
      onToggleAmounts={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
}
it("does not invent zero totals when every account lacks a usable valuation", () => {
  const noBaseline: AssetAccount = {
    ...base,
    id: "future",
    name: "尚无基准",
    currency: "CNY",
    balanceAt: "2027-01-01 00:00:00",
    checkpoints: [],
  };
  const noRate: AssetAccount = {
    ...base,
    id: "usd",
    name: "美元",
    currency: "USD",
    balanceAt: "2026-01-01 00:00:00",
    checkpoints: [],
  };
  const view = renderSummary([noBaseline, noRate]);
  expect(screen.getAllByText("暂无估值")).toHaveLength(3);
  expect(view.container.textContent).not.toContain("¥0.00");
  expect(view.container.textContent).toContain("缺少汇率");
  expect(view.container.textContent).toContain("尚无基准");
});
it("distinguishes an empty ledger from a real zero balance", () => {
  const view = renderSummary([]);
  expect(screen.getAllByText("暂无估值")).toHaveLength(3);
  view.unmount();
  renderSummary([
    {
      ...base,
      id: "zero",
      currency: "CNY",
      openingBalance: 0,
      balanceAt: "2026-01-01 00:00:00",
      checkpoints: [],
    },
  ]);
  expect(screen.getAllByText("¥0.00")).toHaveLength(3);
  expect(screen.queryByText("暂无估值")).toBeNull();
});
it("keeps a zero-valued account in a partial valuation", () => {
  const zero: AssetAccount = {
    ...base,
    id: "zero",
    currency: "CNY",
    openingBalance: 0,
    balanceAt: "2026-01-01 00:00:00",
    checkpoints: [],
  };
  const usd: AssetAccount = {
    ...base,
    id: "usd",
    name: "美元",
    currency: "USD",
    balanceAt: "2026-01-01 00:00:00",
    checkpoints: [],
  };
  renderSummary([zero, usd]);
  expect(screen.getAllByText("¥0.00")).toHaveLength(3);
  expect(screen.getByText("已估值净资产")).toBeTruthy();
});

it("also avoids showing a fabricated zero in the overview asset snapshot", () => {
  const ledger = { ...createDemoLedger(), accounts: [], records: [] };
  const view = render(<AssetSnapshot ledger={ledger} onOpen={vi.fn()} />);
  expect(view.container.textContent?.match(/暂无估值/g)).toHaveLength(3);
  expect(view.container.textContent).not.toContain("¥0.00");
});

it("does not expose account names in missing-baseline alerts while amounts are hidden", () => {
  const account: AssetAccount = {
    ...base,
    id: "future-hidden",
    name: "账户 8.88",
    currency: "CNY",
    balanceAt: "2027-01-01 00:00:00",
    checkpoints: [],
  };
  const ledger = { ...createDemoLedger(), accounts: [account], records: [] };
  const totals = summarizeAssets({ ledger, through });
  const view = render(
    <AssetSummary
      valuationDate="2026-11-06"
      totals={totals}
      comparison={{
        previousDate: "2026-10-31",
        netChange: null,
        unavailableAccounts: [account.name],
        accountChanges: {},
      }}
      isAmountHidden
      onShowValuation={vi.fn()}
      onToggleAmounts={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  expect(view.container.textContent).not.toContain("8.88");
  expect(view.container.querySelector('[aria-label*="8.88"]')).toBeNull();
});
