// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import {
  DEFAULT_PREFERENCES,
  EMPTY_LEDGER,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { AssetsPage } from "../apps/web/src/components/assets/AssetsPage";

const { client } = vi.hoisted(() => ({ client: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => client,
}));
vi.mock("../apps/web/src/platform/browser/runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../apps/web/src/platform/browser/runtime")
  >()),
  localNow: () => "2026-11-07 12:00:00",
}));
afterEach(cleanup);
const bank: AssetAccount = {
  id: "bank-id",
  name: "工资 88.88",
  kind: "asset",
  type: "银行卡",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: ["别名 77.77"],
  isArchived: false,
  checkpoints: [],
  currency: "CNY",
};
const card: AssetAccount = {
  ...bank,
  id: "card-id",
  name: "信用 99.99",
  kind: "liability",
  type: "信用卡",
  openingBalance: -10000,
  aliases: ["卡别名 66.66"],
};
const hiddenLedger: Ledger = {
  ...EMPTY_LEDGER,
  accounts: [bank, card],
  preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
};
function page(
  ledger: Ledger,
  onArchive = vi.fn().mockResolvedValue(undefined),
  onCommit = vi.fn().mockResolvedValue(undefined),
) {
  return (
    <AssetsPage
      ledger={ledger}
      isDemo={false}
      onSave={vi.fn()}
      onArchive={onArchive}
      onRecord={vi.fn()}
      onUnassigned={vi.fn()}
      onLoadExamples={vi.fn()}
      onCommit={onCommit}
    />
  );
}
function expectSensitiveNamesHidden(): void {
  const markup = document.body.innerHTML;
  for (const value of ["88.88", "99.99", "77.77", "66.66"])
    expect(markup).not.toContain(value);
}
it("uses distinct generic labels and archives the selected real account without exposing names", async () => {
  const onArchive = vi.fn().mockResolvedValue(undefined);
  render(page(hiddenLedger, onArchive));
  expectSensitiveNamesHidden();
  expect(screen.getByRole("button", { name: /资产账户 1/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /负债账户 2/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /资产账户 1/ }));
  expect(screen.getByRole("heading", { name: "资产账户 1" })).toBeTruthy();
  expectSensitiveNamesHidden();
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  expectSensitiveNamesHidden();
  fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
  await waitFor(() =>
    expect(onArchive).toHaveBeenCalledWith({
      accountId: "bank-id",
      isArchived: true,
    }),
  );
});
it("hides prepaid direction and restores the original name and alias when privacy is disabled", () => {
  const view = render(page(hiddenLedger));
  fireEvent.click(screen.getByRole("button", { name: /负债账户 2/ }));
  expect(screen.getByRole("heading", { name: "负债账户 2" })).toBeTruthy();
  expectSensitiveNamesHidden();
  expect(document.body.textContent).not.toContain("预存余额");
  view.rerender(
    page({
      ...hiddenLedger,
      preferences: { ...DEFAULT_PREFERENCES, hideAmounts: false },
    }),
  );
  expect(screen.getByRole("heading", { name: card.name })).toBeTruthy();
  expect(screen.getByText(/卡别名 66\.66/)).toBeTruthy();
  expect(screen.getByText("预存余额")).toBeTruthy();
});
it("keeps generic labels selectable in transfer while persisting the actual IDs", async () => {
  const onCommit = vi.fn().mockResolvedValue(undefined);
  render(page(hiddenLedger, vi.fn(), onCommit));
  fireEvent.click(screen.getByRole("button", { name: "账户间转账" }));
  fireEvent.change(screen.getByRole("textbox", { name: "转出金额（CNY）" }), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("combobox", { name: "转出账户" }));
  fireEvent.click(screen.getByRole("option", { name: /资产账户 1/ }));
  fireEvent.click(screen.getByRole("combobox", { name: "转入账户" }));
  fireEvent.click(screen.getByRole("option", { name: /负债账户 2/ }));
  expectSensitiveNamesHidden();
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
  const saved: Ledger = onCommit.mock.calls[0][0];
  expect(saved.records.at(-1)).toMatchObject({
    kind: "转账",
    accountId: "bank-id",
    transferToAccountId: "card-id",
  });
});
it("masks account names in missing-baseline notices", () => {
  const missing = { ...bank, balanceAt: "2099-01-01 00:00:00" };
  render(page({ ...hiddenLedger, accounts: [missing] }));
  expectSensitiveNamesHidden();
  expect(screen.getByText(/部分账户.*尚无余额基准/)).toBeTruthy();
});

it("does not disclose prepaid direction in a hidden repayment preview", async () => {
  const onCommit = vi.fn().mockResolvedValue(undefined);
  render(page(hiddenLedger, vi.fn(), onCommit));
  fireEvent.click(screen.getByRole("button", { name: /负债账户 2/ }));
  fireEvent.click(screen.getByRole("button", { name: "还款" }));
  fireEvent.change(screen.getByRole("textbox", { name: /本次还款/ }), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByRole("combobox", { name: "付款资产账户" }));
  fireEvent.click(screen.getByRole("option", { name: /资产账户 1/ }));
  expectSensitiveNamesHidden();
  expect(document.body.textContent).not.toContain("预存");
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
  const saved: Ledger = onCommit.mock.calls[0][0];
  expect(saved.records.at(-1)).toMatchObject({
    kind: "转账",
    accountId: "bank-id",
    transferToAccountId: "card-id",
  });
});

it("uses the same generic account label when opening calibration", () => {
  render(page(hiddenLedger));
  fireEvent.click(screen.getByRole("button", { name: /资产账户 1/ }));
  fireEvent.click(screen.getByRole("button", { name: "核对实际余额" }));
  expect(screen.getByText(/资产账户 1 · CNY/)).toBeTruthy();
  expectSensitiveNamesHidden();
});
