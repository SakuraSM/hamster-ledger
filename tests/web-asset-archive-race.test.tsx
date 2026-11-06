// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import { EMPTY_LEDGER, type AssetAccount } from "@hamster-ledger/core";
import { AssetsPage } from "../apps/web/src/components/assets/AssetsPage";
import { AccountDetail } from "../apps/web/src/components/assets/AccountDetail";
const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
afterEach(cleanup);
const account: AssetAccount = {
  id: "bank",
  name: "工资卡",
  kind: "asset",
  type: "银行卡",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};
const props = {
  isDemo: false,
  onSave: vi.fn(),
  onRecord: vi.fn(),
  onUnassigned: vi.fn(),
  onLoadExamples: vi.fn(),
  onCommit: vi.fn(),
};

it("never reverses a pending archive when the account changes state", () => {
  const onArchive = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <AssetsPage
      {...props}
      ledger={{ ...EMPTY_LEDGER, accounts: [account] }}
      onArchive={onArchive}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  expect(screen.getByRole("dialog", { name: "归档账户" })).toBeTruthy();
  rerender(
    <AssetsPage
      {...props}
      ledger={{ ...EMPTY_LEDGER, accounts: [{ ...account, isArchived: true }] }}
      onArchive={onArchive}
    />,
  );
  expect(screen.getByRole("alert").textContent).toMatch(
    /状态.*变化|账户.*变化/,
  );
  expect(
    (screen.getByRole("button", { name: "确认归档" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
  expect(onArchive).not.toHaveBeenCalled();
  rerender(
    <AssetsPage
      {...props}
      ledger={{ ...EMPTY_LEDGER, accounts: [account] }}
      onArchive={onArchive}
    />,
  );
  expect(
    (screen.getByRole("button", { name: "确认归档" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
  expect(onArchive).not.toHaveBeenCalled();
});

it("blocks a pending restore after the account was already restored", () => {
  const onArchive = vi.fn().mockResolvedValue(undefined);
  const archived = { ...account, isArchived: true };
  const { rerender } = render(
    <AssetsPage
      {...props}
      ledger={{ ...EMPTY_LEDGER, accounts: [archived] }}
      onArchive={onArchive}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "显示已归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
  fireEvent.click(screen.getByRole("button", { name: "恢复账户" }));
  rerender(
    <AssetsPage
      {...props}
      ledger={{ ...EMPTY_LEDGER, accounts: [account] }}
      onArchive={onArchive}
    />,
  );
  expect(screen.getByRole("alert").textContent).toMatch(
    /状态.*变化|账户.*变化/,
  );
  expect(
    (screen.getByRole("button", { name: "确认恢复" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
  expect(onArchive).not.toHaveBeenCalled();
});

it("blocks confirmation if the displayed account ID changes", () => {
  const onArchive = vi.fn().mockResolvedValue(undefined);
  const detailProps = {
    ledger: { ...EMPTY_LEDGER, accounts: [account] },
    through: "2026-11-07 23:59:59",
    isHidden: false,
    recordRequest: 0,
    traceRequest: 0,
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onCalibrate: vi.fn(),
    onTransfer: vi.fn(),
    onArchive,
    onRecord: vi.fn(),
  };
  const { rerender } = render(
    <AccountDetail {...detailProps} account={account} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  rerender(
    <AccountDetail
      {...detailProps}
      account={{ ...account, id: "other", name: "另一账户" }}
    />,
  );
  expect(screen.getByRole("alert").textContent).toMatch(/账户.*变化/);
  expect(
    (screen.getByRole("button", { name: "确认归档" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
  expect(onArchive).not.toHaveBeenCalled();
});
