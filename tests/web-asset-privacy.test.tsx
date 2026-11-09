// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "./helpers/render";
import {
  EMPTY_LEDGER,
  type AssetAccount,
  type BillRecord,
} from "@hamster-ledger/core";
import { AccountHistory } from "../apps/web/src/components/assets/AccountHistory";
import { AccountDetail } from "../apps/web/src/components/assets/AccountDetail";

afterEach(cleanup);
const sensitive = "支付成功12.34元";
const account: AssetAccount = {
  id: "cash",
  name: "现金",
  kind: "asset",
  type: "现金",
  openingBalance: 50000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [
    {
      id: "baseline",
      balance: 50000,
      at: "2026-01-01 00:00:00",
      note: sensitive,
      recordedAt: "2026-01-01 00:00:00",
    },
  ],
};
const bill: BillRecord = {
  id: "bill",
  date: "2026-02-01 12:00:00",
  merchant: sensitive,
  description: sensitive,
  amount: 1234,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "手动记账",
  account: "现金",
  accountId: "cash",
  orderId: "",
  status: "confirmed",
  sourceStatus: "成功",
  fileName: "",
  raw: {},
  linkedSources: [],
};
const ledger = { ...EMPTY_LEDGER, accounts: [account], records: [bill] };

it("does not expose private descriptions or merchant names in either history mode", () => {
  const onRecord = vi.fn();
  const { container, rerender } = render(
    <AccountHistory
      ledger={ledger}
      account={account}
      through="2026-11-07 23:59:59"
      isHidden
      recordRequest={0}
      traceRequest={0}
      onRecord={onRecord}
    />,
  );
  expect(container.innerHTML).not.toContain(sensitive);
  fireEvent.click(screen.getByRole("button", { name: "查看账单详情" }));
  expect(onRecord).toHaveBeenCalledWith(bill);
  fireEvent.click(screen.getByRole("button", { name: "关联账单" }));
  expect(container.innerHTML).not.toContain(sensitive);
  fireEvent.click(screen.getByRole("button", { name: "查看账单详情" }));
  expect(onRecord).toHaveBeenCalledTimes(2);
  rerender(
    <AccountHistory
      ledger={ledger}
      account={account}
      through="2026-11-07 23:59:59"
      isHidden={false}
      recordRequest={0}
      traceRequest={0}
      onRecord={onRecord}
    />,
  );
  expect(
    screen.getByRole("button", { name: `查看${sensitive}账单详情` }),
  ).toBeTruthy();
});

it("does not expose saved checkpoint notes when amounts are hidden", () => {
  const { container } = render(
    <AccountDetail
      account={account}
      ledger={ledger}
      through="2026-11-07 23:59:59"
      isHidden
      recordRequest={0}
      traceRequest={0}
      onBack={vi.fn()}
      onEdit={vi.fn()}
      onCalibrate={vi.fn()}
      onTransfer={vi.fn()}
      onArchive={vi.fn()}
      onRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText(/余额基准与历史/));
  expect(container.innerHTML).not.toContain(sensitive);
});
it("offers balance calibration and transfer before a potentially long history", () => {
  const onCalibrate = vi.fn(),
    onTransfer = vi.fn();
  render(
    <AccountDetail
      account={account}
      ledger={ledger}
      through="2026-11-07 23:59:59"
      isHidden={false}
      recordRequest={0}
      traceRequest={0}
      onBack={vi.fn()}
      onEdit={vi.fn()}
      onCalibrate={onCalibrate}
      onTransfer={onTransfer}
      onArchive={vi.fn()}
      onRecord={vi.fn()}
    />,
  );
  const calibrate = screen.getByRole("button", { name: "核对实际余额" });
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: "现金" }),
  );
  const history = screen.getByRole("button", {
    name: "查看支付成功12.34元账单详情",
  });
  expect(
    calibrate.compareDocumentPosition(history) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(calibrate);
  fireEvent.click(screen.getByRole("button", { name: "转账" }));
  expect(onCalibrate).toHaveBeenCalledOnce();
  expect(onTransfer).toHaveBeenCalledOnce();
});
