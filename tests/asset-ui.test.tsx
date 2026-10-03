// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "./helpers/render";
import { TransactionTable } from "../apps/web/src/components/TransactionTable";
import { AccountEditor } from "../apps/web/src/components/assets/AccountEditor";
import { AssetsPage } from "../apps/web/src/components/assets/AssetsPage";
import { RecordDetail } from "../apps/web/src/components/RecordDetail";
import {
  EMPTY_LEDGER,
  type AssetAccount,
  type BillRecord,
} from "@hamster-ledger/core";

const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));

// JSDOM does not implement the native dialog APIs; focus behavior is checked in the browser.
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement): void {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement): void {
      this.open = false;
    },
  });
});
afterEach(cleanup);
const bill: BillRecord = {
  id: "sample",
  date: "2026-09-15 12:00:00",
  merchant: "测试咖啡",
  description: "一杯咖啡",
  amount: 3600,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "支付宝",
  account: "招行工资卡",
  accountId: "bank",
  orderId: "virtual-order",
  status: "confirmed",
  sourceStatus: "成功",
  fileName: "virtual.csv",
  raw: { 说明: "虚拟样本" },
  linkedSources: [],
};
const bank: AssetAccount = {
  id: "bank",
  name: "招行工资卡",
  kind: "asset",
  type: "银行卡",
  openingBalance: 100000,
  balanceAt: "2026-09-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};

describe("single-record and asset account UI", () => {
  it("offers an explicit detail action for each bill", () => {
    const select = vi.fn();
    render(<TransactionTable records={[bill]} onSelect={select} />);
    fireEvent.click(
      screen.getByRole("button", { name: "查看测试咖啡账单详情" }),
    );
    expect(select).toHaveBeenCalledWith(bill);
  });
  it("opens linked records from the managed account detail view", () => {
    const onRecord = vi.fn();
    render(
      <AssetsPage
        ledger={{ ...EMPTY_LEDGER, accounts: [bank], records: [bill] }}
        isDemo={false}
        onSave={vi.fn()}
        onArchive={vi.fn()}
        onRecord={onRecord}
        onUnassigned={vi.fn()}
        onLoadExamples={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /招行工资卡/ }));
    expect(
      screen.getByRole("heading", { name: "关联收入与支出" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "查看测试咖啡账单详情" }),
    );
    expect(onRecord).toHaveBeenCalledWith(bill);
  });
  it("saves a liability account in integer cents with its explicit baseline", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 1));
    render(<AccountEditor onSave={save} onClose={vi.fn()} />);
    vi.useRealTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "信用卡 · 8899" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "账户性质" }));
    fireEvent.click(screen.getByRole("option", { name: "负债账户" }));
    fireEvent.change(screen.getByRole("textbox", { name: "基准负债（CNY）" }), {
      target: { value: "6500.80" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].account).toMatchObject({
      kind: "liability",
      type: "信用卡",
      openingBalance: 650080,
      balanceAt: "2026-09-01 00:00:00",
    });
  });
  it("links a bill to a selected managed account from its detail form", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDetail
        record={{ ...bill, accountId: null }}
        ledger={{ ...EMPTY_LEDGER, records: [bill], accounts: [bank] }}
        onSave={save}
        onClose={vi.fn()}
        onRelated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "关联资产账户" }));
    fireEvent.click(screen.getByRole("option", { name: /招行工资卡/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].accountId).toBe("bank");
  });
});
