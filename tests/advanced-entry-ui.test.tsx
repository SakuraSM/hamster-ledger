// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "./helpers/render";
import { AdvancedEntryEditor } from "../apps/web/src/components/finance/AdvancedEntryEditor";
import { EMPTY_LEDGER, migrateLedger, type Ledger } from "@hamster-ledger/core";
const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
afterEach(cleanup);
function ledger(currency: "CNY" | "USD" = "CNY"): Ledger {
  return migrateLedger({
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name: "虚拟账户",
        kind: "asset",
        type: "银行卡",
        currency,
        openingBalance: 0,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        checkpoints: [],
        isArchived: false,
      },
    ],
  });
}
it("retains form values and the transaction id after a rejected save", async () => {
  const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("版本冲突，请核对"))
      .mockResolvedValue(undefined),
    close = vi.fn();
  render(
    <AdvancedEntryEditor
      ledger={ledger()}
      date="2026-10-03"
      onSave={save}
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "商户 / 交易名称" }), {
    target: { value: "虚拟早餐" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "原币金额（CNY）" }), {
    target: { value: "20.01" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存完整交易" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("版本冲突"),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "商户 / 交易名称",
      }) as HTMLInputElement
    ).value,
  ).toBe("虚拟早餐");
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "保存完整交易" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].records[0].id).toBe(
    save.mock.calls[1][0].records[0].id,
  );
  expect(save.mock.calls[1][0].records[0].amount).toBe(2001);
});
it("never fills an unknown foreign exchange rate with one", () => {
  render(
    <AdvancedEntryEditor
      ledger={ledger("USD")}
      date="2026-10-03"
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "1 USD 折合人民币",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
});
