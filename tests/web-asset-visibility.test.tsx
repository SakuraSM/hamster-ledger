// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
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
  id: "bank",
  name: "工资 88.88",
  kind: "asset",
  type: "银行卡",
  currency: "CNY",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: ["别名 77.77"],
  checkpoints: [],
  isArchived: false,
};
const card: AssetAccount = {
  ...bank,
  id: "card",
  name: "信用 99.99",
  kind: "liability",
  type: "信用卡",
  openingBalance: -10000,
  aliases: [],
};
function ledger(isHidden: boolean): Ledger {
  return {
    ...EMPTY_LEDGER,
    accounts: [bank, card],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: isHidden },
  };
}
function page(data: Ledger, onCommit = vi.fn(), onSave = vi.fn()) {
  return (
    <AssetsPage
      ledger={data}
      isDemo={false}
      onSave={onSave}
      onCommit={onCommit}
      onArchive={vi.fn()}
      onRecord={vi.fn()}
      onUnassigned={vi.fn()}
      onLoadExamples={vi.fn()}
    />
  );
}
function expectHidden(): void {
  const markup = document.body.innerHTML;
  expect(markup).not.toMatch(
    /工资 88\.88|信用 99\.99|别名 77\.77|¥1,000\.00|预存余额/,
  );
}

it("starts with the persisted hidden preference and the temporary reveal follows into detail without persisting", () => {
  const data = ledger(true);
  const onCommit = vi.fn();
  const onSave = vi.fn();
  const view = render(page(data, onCommit, onSave));
  expectHidden();
  fireEvent.click(screen.getByRole("button", { name: "显示金额" }));
  expect(screen.getByRole("button", { name: "隐藏金额" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /工资 88\.88/ }));
  expect(screen.getByRole("heading", { name: "工资 88.88" })).toBeTruthy();
  expect(screen.getByText(/别名 77\.77/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "转账" }));
  expect(
    (screen.getByRole("combobox", { name: "转出账户" }) as HTMLInputElement)
      .value,
  ).toContain("工资 88.88");
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  fireEvent.click(screen.getByRole("button", { name: /返回资产管理/ }));
  fireEvent.click(screen.getByRole("button", { name: "隐藏金额" }));
  expectHidden();
  fireEvent.click(screen.getByRole("button", { name: /资产账户 1/ }));
  expect(screen.getByRole("heading", { name: "资产账户 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "核对实际余额" }));
  expect(screen.getByText(/资产账户 1 · CNY/)).toBeTruthy();
  expectHidden();
  expect(onCommit).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
  expect(data.preferences?.hideAmounts).toBe(true);
  view.unmount();
  render(page(data));
  expect(screen.getByRole("button", { name: "显示金额" })).toBeTruthy();
  expectHidden();
});

it("hides a visible page, including an entered search value, without changing the persisted preference", () => {
  const data = ledger(false);
  const onCommit = vi.fn();
  render(page(data, onCommit));
  fireEvent.change(screen.getByLabelText("查找账户"), {
    target: { value: "88.88" },
  });
  fireEvent.click(screen.getByRole("button", { name: "隐藏金额" }));
  expect((screen.getByLabelText("查找账户") as HTMLInputElement).value).toBe(
    "",
  );
  expectHidden();
  expect(data.preferences?.hideAmounts).toBe(false);
  expect(onCommit).not.toHaveBeenCalled();
});

it("follows a changed persisted preference until the user chooses a temporary override", () => {
  const view = render(page(ledger(false)));
  expect(screen.getByRole("button", { name: "隐藏金额" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("查找账户"), {
    target: { value: "88.88" },
  });
  view.rerender(page(ledger(true)));
  expect(screen.getByRole("button", { name: "显示金额" })).toBeTruthy();
  expect((screen.getByLabelText("查找账户") as HTMLInputElement).value).toBe(
    "",
  );
  expectHidden();
  fireEvent.click(screen.getByRole("button", { name: "显示金额" }));
  view.rerender(page(ledger(true)));
  expect(screen.getByRole("button", { name: "隐藏金额" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /工资 88\.88/ })).toBeTruthy();
});
