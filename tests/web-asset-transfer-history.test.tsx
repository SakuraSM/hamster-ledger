// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import {
  EMPTY_LEDGER,
  summarizeAssets,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { TransferEditor } from "../apps/web/src/components/assets/TransferEditor";

vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => ({ request: vi.fn() }),
}));
vi.mock("../apps/web/src/platform/browser/runtime", () => ({
  localNow: () => "2026-11-06 17:30:00",
  newEntityId: () => "repayment-history",
}));
vi.mock("../apps/web/src/ui/Choice", () => ({
  Choice: ({
    label,
    value,
    onChange,
    children,
    disabled,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
    disabled?: boolean;
  }) => (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  ),
}));
vi.mock("../apps/web/src/ui/DateField", () => ({
  DateField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
}));
afterEach(cleanup);

const bank: AssetAccount = {
  id: "bank",
  name: "工资卡",
  kind: "asset",
  type: "银行卡",
  currency: "CNY",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};
const card: AssetAccount = {
  ...bank,
  id: "card",
  name: "信用卡",
  kind: "liability",
  type: "信用卡",
  openingBalance: 80000,
};

function openRepayment(input: {
  ledger: Ledger;
  card: AssetAccount;
  isHidden?: boolean;
}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <TransferEditor
      ledger={input.ledger}
      repaymentAccount={input.card}
      isHidden={input.isHidden ?? false}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  expect(
    (screen.getByLabelText("付款资产账户") as HTMLSelectElement).value,
  ).toBe("");
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: "bank" },
  });
  return onSave;
}

it("confirms the CNY repayment preview with actual saved net assets", async () => {
  const ledger = { ...EMPTY_LEDGER, accounts: [bank, card] };
  const onSave = openRepayment({ ledger, card });
  fireEvent.change(screen.getByRole("textbox", { name: "本次还款（CNY）" }), {
    target: { value: "500" },
  });
  expect(screen.getByText(/净资产不变/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const saved: Ledger = onSave.mock.calls[0][0];
  const through = "2026-11-06 17:30:00";
  expect(summarizeAssets({ ledger: saved, through }).netAssets).toBe(
    summarizeAssets({ ledger, through }).netAssets,
  );
  expect(saved.records[0]).toMatchObject({
    accountId: bank.id,
    transferToAccountId: card.id,
    kind: "转账",
  });
});

it("keeps preview amounts, account names and balance direction hidden", () => {
  const prepaid = { ...card, name: "信用卡 ¥800", openingBalance: -80000 };
  const source = { ...bank, name: "工资 ¥1,000" };
  const ledger = { ...EMPTY_LEDGER, accounts: [source, prepaid] };
  openRepayment({ ledger, card: prepaid, isHidden: true });
  fireEvent.change(screen.getByRole("textbox", { name: "本次还款（CNY）" }), {
    target: { value: "500" },
  });
  const preview = screen.getByText(/还款不计支出/);
  expect(preview.textContent).toContain("••••");
  expect(preview.textContent).not.toMatch(/¥|预存|负债(?!账户)|净资产不变/);
  expect(screen.queryByText(/工资 ¥1,000|信用卡 ¥800/)).toBeNull();
});

it("does not predict a result without a baseline or for a cross-currency repayment", () => {
  const source = { ...bank, balanceAt: "2026-12-01 00:00:00" };
  const ledger = { ...EMPTY_LEDGER, accounts: [source, card] };
  openRepayment({ ledger, card });
  fireEvent.change(screen.getByRole("textbox", { name: "本次还款（CNY）" }), {
    target: { value: "500" },
  });
  expect(screen.getByText(/缺少基准或跨币种时不预测净资产/)).toBeTruthy();
  expect(screen.queryByText(/净资产不变/)).toBeNull();
  cleanup();
  const dollars: AssetAccount = { ...bank, currency: "USD" };
  openRepayment({ ledger: { ...ledger, accounts: [dollars, card] }, card });
  fireEvent.change(screen.getByRole("textbox", { name: "本次还款（USD）" }), {
    target: { value: "500" },
  });
  expect(screen.getByText(/缺少基准或跨币种时不预测净资产/)).toBeTruthy();
  expect(screen.queryByText(/净资产不变/)).toBeNull();
});

it.each(["asset", "liability"] as const)(
  "suppresses the preview when the %s account was archived on the selected historical date",
  async (kind) => {
    const archiveHistory = [
      { at: "2026-11-01 00:00:00", isArchived: true },
      { at: "2026-11-05 00:00:00", isArchived: false },
    ];
    const source = kind === "asset" ? { ...bank, archiveHistory } : bank;
    const target = kind === "liability" ? { ...card, archiveHistory } : card;
    const ledger = { ...EMPTY_LEDGER, accounts: [source, target] };
    const onSave = openRepayment({ ledger, card: target });
    fireEvent.change(screen.getByRole("textbox", { name: "本次还款（CNY）" }), {
      target: { value: "500" },
    });
    expect(screen.getByText(/净资产不变/)).toBeTruthy();
    const through = "2026-11-02 17:30:00";
    fireEvent.change(screen.getByLabelText("还款时间"), {
      target: { value: "2026-11-02T17:30:00" },
    });
    expect(screen.queryByText(/净资产不变/)).toBeNull();
    expect(screen.getByText(/还款时间.*已归档.*无法预览/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: Ledger = onSave.mock.calls[0][0];
    expect(
      summarizeAssets({ ledger: saved, through }).netAssets -
        summarizeAssets({ ledger, through }).netAssets,
    ).toBe(kind === "asset" ? 50000 : -50000);
  },
);

it("does not assert unchanged CNY net assets for a foreign repayment whose rounded valuation changes", async () => {
  const source: AssetAccount = { ...bank, currency: "USD", openingBalance: 2 };
  const target: AssetAccount = { ...card, currency: "USD", openingBalance: 1 };
  const ledger = { ...EMPTY_LEDGER, accounts: [source, target] };
  const onSave = openRepayment({ ledger, card: target });
  fireEvent.change(screen.getByRole("textbox", { name: "本次还款（USD）" }), {
    target: { value: "0.01" },
  });
  expect(screen.queryByText(/净资产不变/)).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "1 USD 折合人民币" }), {
    target: { value: "1.5" },
  });
  expect(screen.queryByText(/净资产不变/)).toBeNull();
  expect(
    screen.getByText(/原币净额不变.*人民币估值可能受汇率和舍入影响/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const saved: Ledger = onSave.mock.calls[0][0];
  const through = "2026-11-06 17:30:00";
  const rates = [
    {
      currency: "USD" as const,
      rate: "1.5",
      date: "2026-11-06",
      source: "manual" as const,
    },
  ];
  expect(summarizeAssets({ ledger, through, rates }).netAssets).toBe(1);
  expect(summarizeAssets({ ledger: saved, through, rates }).netAssets).toBe(2);
});
