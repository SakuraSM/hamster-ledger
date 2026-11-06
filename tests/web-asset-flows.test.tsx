// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import { AccountEditor } from "../apps/web/src/components/assets/AccountEditor";
import { AssetsPage } from "../apps/web/src/components/assets/AssetsPage";
import {
  EMPTY_LEDGER,
  DEFAULT_PREFERENCES,
  projectAccountBalance,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";

const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));

afterEach(cleanup);

const bank: AssetAccount = {
  id: "bank",
  name: "工资卡",
  kind: "asset",
  type: "银行卡",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
  currency: "CNY",
};
const card: AssetAccount = {
  id: "card",
  name: "信用卡",
  kind: "liability",
  type: "信用卡",
  openingBalance: 30000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
  currency: "CNY",
};

function renderAssets(
  ledger: Ledger,
  onCommit = vi.fn().mockResolvedValue(undefined),
): void {
  render(
    <AssetsPage
      ledger={ledger}
      isDemo={false}
      onSave={vi.fn()}
      onArchive={vi.fn()}
      onRecord={vi.fn()}
      onUnassigned={vi.fn()}
      onLoadExamples={vi.fn()}
      onCommit={onCommit}
    />,
  );
}

describe("asset account flows", () => {
  it("requires an explicit funding account for repayment and records a transfer", async () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [bank, card] };
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderAssets(ledger, onCommit);
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "还款" }));
    const funding = screen.getByRole("combobox", {
      name: /付款资产账户|收付款账户/,
    }) as HTMLInputElement;
    expect(funding.value).not.toContain("工资卡");
    fireEvent.change(
      screen.getByRole("textbox", { name: /原币金额（CNY）|本次还款/ }),
      { target: { value: "100" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /确认记录还款|保存完整交易/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/选择.*账户/),
    );
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(funding);
    fireEvent.click(screen.getByRole("option", { name: /工资卡/ }));
    expect(screen.getByText(/净资产不变/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /确认记录还款|保存完整交易/ }),
    );
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    const saved = onCommit.mock.calls[0][0] as Ledger;
    const record = saved.records.at(-1);
    expect(record).toMatchObject({
      kind: "转账",
      accountId: "bank",
      transferToAccountId: "card",
    });
    expect(
      projectAccountBalance({
        ledger: saved,
        account: bank,
        through: "9999-12-31 23:59:59",
      }).balance,
    ).toBe(90000);
    expect(
      projectAccountBalance({
        ledger: saved,
        account: card,
        through: "9999-12-31 23:59:59",
      }).balance,
    ).toBe(20000);
  });
  it("hides balances and account activity when the ledger hides amounts", () => {
    renderAssets({
      ...EMPTY_LEDGER,
      accounts: [bank, card],
      preferences: { ...DEFAULT_PREFERENCES, hideAmounts: true },
    });
    expect(screen.queryByText("¥1,000.00")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /资产账户 1/ }));
    expect(screen.getByRole("heading", { name: "资产账户 1" })).toBeTruthy();
    expect(screen.queryByText("¥1,000.00")).toBeNull();
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
  });

  it("requires a new account baseline to be entered explicitly", () => {
    render(<AccountEditor onSave={vi.fn()} onClose={vi.fn()} />);
    expect(
      (
        screen.getByRole("textbox", {
          name: "基准余额（CNY）",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("does not turn a missing historical baseline into zero", () => {
    const future = { ...bank, balanceAt: "2099-01-01 00:00:00" };
    renderAssets({ ...EMPTY_LEDGER, accounts: [future] });
    expect(screen.getAllByText("暂无估值").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
    expect(screen.getByText("尚无余额基准")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "核对实际余额" }));
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("opens the current account's records from calibration", async () => {
    const bill: BillRecord = {
      id: "card-bill",
      date: "2026-02-01 12:00:00",
      merchant: "刷卡",
      description: "",
      amount: 100,
      currency: "CNY",
      kind: "支出",
      category: "餐饮",
      source: "手动记账",
      account: card.name,
      accountId: card.id,
      orderId: "",
      status: "confirmed",
      sourceStatus: "成功",
      fileName: "",
      raw: {},
      linkedSources: [],
    };
    const onRecord = vi.fn();
    render(
      <AssetsPage
        ledger={{ ...EMPTY_LEDGER, accounts: [bank, card], records: [bill] }}
        isDemo={false}
        onSave={vi.fn()}
        onArchive={vi.fn()}
        onRecord={onRecord}
        onUnassigned={vi.fn()}
        onLoadExamples={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "核对实际余额" }));
    fireEvent.click(screen.getByRole("button", { name: "先查账单" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "关联账单" })
          .getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "账户明细" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "查看刷卡账单详情" }));
    expect(onRecord).toHaveBeenCalledWith(bill);
  });

  it("confirms archive with the selected account ID", async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetsPage
        ledger={{ ...EMPTY_LEDGER, accounts: [bank, card] }}
        isDemo={false}
        onSave={vi.fn()}
        onArchive={onArchive}
        onRecord={vi.fn()}
        onUnassigned={vi.fn()}
        onLoadExamples={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
    expect(onArchive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
    await waitFor(() =>
      expect(onArchive).toHaveBeenCalledWith({
        accountId: "card",
        isArchived: true,
      }),
    );
  });

  it("keeps foreign currency unvalued until a valid rate is supplied", async () => {
    const foreign: AssetAccount = {
      ...bank,
      id: "usd",
      name: "外币账户",
      currency: "USD",
    };
    renderAssets({ ...EMPTY_LEDGER, accounts: [foreign] });
    expect(screen.getByRole("alert").textContent).toContain("USD 缺少汇率");
    expect(screen.getAllByText("暂无估值").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("估值日期与汇率"));
    fireEvent.click(screen.getByText("估值汇率（原币 1 单位折合人民币）"));
    const rate = screen.getByRole("textbox", { name: "USD" });
    fireEvent.change(rate, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "使用手动汇率" }));
    expect(screen.getByText("汇率必须为大于零的数字。")).toBeTruthy();
    fireEvent.change(rate, { target: { value: "7.10" } });
    fireEvent.click(screen.getByRole("button", { name: "使用手动汇率" }));
    await waitFor(() =>
      expect(screen.getAllByText("¥7,100.00").length).toBeGreaterThan(0),
    );
  });

  it("transfers from the selected account only after the destination is chosen", async () => {
    const wallet: AssetAccount = {
      ...bank,
      id: "wallet",
      name: "零钱",
      type: "网络钱包",
      openingBalance: 5000,
    };
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderAssets({ ...EMPTY_LEDGER, accounts: [bank, wallet] }, onCommit);
    fireEvent.click(screen.getByRole("button", { name: /零钱/ }));
    fireEvent.click(screen.getByRole("button", { name: "转账" }));
    expect(
      (screen.getByRole("combobox", { name: "转出账户" }) as HTMLInputElement)
        .value,
    ).toContain("零钱");
    fireEvent.change(screen.getByRole("textbox", { name: "转出金额（CNY）" }), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("请选择转入账户"),
    );
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("combobox", { name: "转入账户" }));
    fireEvent.click(screen.getByRole("option", { name: /工资卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    const saved = onCommit.mock.calls[0][0] as Ledger;
    expect(saved.records.at(-1)).toMatchObject({
      kind: "转账",
      accountId: "wallet",
      transferToAccountId: "bank",
    });
  });
  it.each([
    { ...bank, id: "bank-2", name: "另一张银行卡" },
    { ...bank, id: "cash", name: "现金", type: "现金" as const },
    { ...bank, id: "wallet", name: "钱包", type: "网络钱包" as const },
    { ...bank, id: "invest", name: "投资账户", type: "投资" as const },
    { ...bank, id: "foreign", name: "美元账户", currency: "USD" as const },
    { ...card, id: "card-2", name: "另一张信用卡" },
  ])("keeps the selected account ID when editing $name", async (account) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetsPage
        ledger={{ ...EMPTY_LEDGER, accounts: [account] }}
        isDemo={false}
        onSave={onSave}
        onArchive={vi.fn()}
        onRecord={vi.fn()}
        onUnassigned={vi.fn()}
        onLoadExamples={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(account.name) }),
    );
    expect(screen.getByRole("heading", { name: account.name })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: `${account.name}更新` },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].account).toMatchObject({
      id: account.id,
      name: `${account.name}更新`,
    });
  });

  it("restores the selected archived account after confirmation", async () => {
    const archived = {
      ...card,
      isArchived: true,
      archiveHistory: [{ at: "2026-02-01 00:00:00", isArchived: true }],
    };
    const onArchive = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetsPage
        ledger={{ ...EMPTY_LEDGER, accounts: [bank, archived] }}
        isDemo={false}
        onSave={vi.fn()}
        onArchive={onArchive}
        onRecord={vi.fn()}
        onUnassigned={vi.fn()}
        onLoadExamples={vi.fn()}
        onCommit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "显示已归档账户" }));
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "恢复账户" }));
    fireEvent.click(screen.getByRole("button", { name: "确认恢复" }));
    await waitFor(() =>
      expect(onArchive).toHaveBeenCalledWith({
        accountId: "card",
        isArchived: false,
      }),
    );
  });
  it("clears a cross-currency destination amount when repayment switches to the same currency", async () => {
    const foreign = {
      ...bank,
      id: "usd",
      name: "美元卡",
      currency: "USD" as const,
    };
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderAssets(
      { ...EMPTY_LEDGER, accounts: [bank, foreign, card] },
      onCommit,
    );
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "还款" }));
    fireEvent.click(screen.getByRole("combobox", { name: "付款资产账户" }));
    fireEvent.click(screen.getByRole("option", { name: /美元卡/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "本次还款（USD）" }), {
      target: { value: "10" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "1 USD 折合人民币" }),
      { target: { value: "7" } },
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "实际转入金额（CNY）" }),
      { target: { value: "70" } },
    );
    fireEvent.click(screen.getByRole("combobox", { name: "付款资产账户" }));
    fireEvent.click(screen.getByRole("option", { name: /工资卡/ }));
    expect(
      screen.queryByRole("textbox", { name: "实际转入金额（CNY）" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    const saved = onCommit.mock.calls[0][0] as Ledger;
    expect(saved.records.at(-1)?.detail?.movements).toEqual([
      { accountId: "bank", amount: -1000 },
      { accountId: "card", amount: -1000 },
    ]);
  });
  it("opens the valuation settings from an account detail", async () => {
    renderAssets({ ...EMPTY_LEDGER, accounts: [bank] });
    fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "估值日期与范围" }));
    expect(screen.getByRole("heading", { name: "资产" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "资产估值日" })).toBeTruthy();
  });

  it("opens the current account balance history from the context panel", async () => {
    renderAssets({ ...EMPTY_LEDGER, accounts: [bank] });
    fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "追溯余额与流水" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name: "账户明细" }),
      ),
    );
    expect(
      screen
        .getByRole("button", { name: "余额变动" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("opens foreign-currency rate controls from the context panel", async () => {
    const foreign: AssetAccount = {
      ...bank,
      id: "usd",
      name: "外币账户",
      currency: "USD",
    };
    renderAssets({ ...EMPTY_LEDGER, accounts: [foreign] });
    fireEvent.click(screen.getByRole("button", { name: "汇率与缺失项" }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "USD" })).toBeTruthy(),
    );
  });
});
