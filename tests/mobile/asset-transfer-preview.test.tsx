// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  projectAccountBalance,
  summarize,
  summarizeAssets,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { AssetTransfer } from "../../apps/mobile/src/screens/AssetTransfer";

vi.mock("react-native-paper", () => ({
  Text: ({
    children,
    accessibilityLabel,
  }: {
    children: ReactNode;
    accessibilityLabel?: string;
  }) => <span aria-label={accessibilityLabel}>{children}</span>,
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  TextInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChangeText(event.currentTarget.value)}
      />
    </label>
  ),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-11-06 17:30:00",
  newEntityId: () => "repayment-preview",
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client: { request: vi.fn() } }),
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
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
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));

afterEach(cleanup);

function repaymentLedger(): {
  ledger: Ledger;
  bank: AssetAccount;
  otherBank: AssetAccount;
  card: AssetAccount;
} {
  const example = createDemoLedger();
  const bank: AssetAccount = {
    ...example.accounts[0],
    id: "bank",
    name: "工资卡",
    kind: "asset",
    type: "银行卡",
    currency: "CNY",
    openingBalance: 100000,
    balanceAt: "2026-10-01 00:00:00",
    aliases: [],
    checkpoints: [],
    isArchived: false,
  };
  const otherBank: AssetAccount = {
    ...bank,
    id: "other",
    name: "储蓄卡",
    openingBalance: 150000,
  };
  const card: AssetAccount = {
    ...bank,
    id: "card",
    name: "信用卡",
    kind: "liability",
    type: "信用卡",
    openingBalance: 80000,
  };
  return {
    ledger: { ...example, accounts: [bank, otherBank, card], records: [] },
    bank,
    otherBank,
    card,
  };
}

function enterRepayment(bank: AssetAccount, amount = "500"): void {
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: bank.id },
  });
  fireEvent.change(
    screen.getByLabelText(`还款金额（${bank.currency ?? "CNY"}）`),
    { target: { value: amount } },
  );
}

it("previews both balances from real projections and saves a 500 yuan repayment without changing net assets or expenses", async () => {
  const { ledger, bank, otherBank, card } = repaymentLedger();
  const onSave = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <AssetTransfer
      ledger={ledger}
      account={card}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  expect(
    (screen.getByLabelText("付款资产账户") as HTMLSelectElement).value,
  ).toBe("");
  enterRepayment(bank);
  expect(screen.getByText(/付款账户.*¥1,000\.00.*¥500\.00/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*¥800\.00.*¥300\.00/)).toBeTruthy();
  expect(screen.getByText(/净资产不变/)).toBeTruthy();
  const refreshedBank = { ...bank, openingBalance: 120000 };
  const refreshedCard = { ...card, openingBalance: 90000 };
  rerender(
    <AssetTransfer
      ledger={{
        ...ledger,
        accounts: [refreshedBank, otherBank, refreshedCard],
      }}
      account={card}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByText(/付款账户.*¥1,200\.00.*¥700\.00/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*¥900\.00.*¥400\.00/)).toBeTruthy();
  expect(screen.getByText(/当前剩余负债.*¥900\.00/)).toBeTruthy();
  rerender(
    <AssetTransfer
      ledger={ledger}
      account={card}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("还款金额（CNY）"), {
    target: { value: "600" },
  });
  expect(screen.getByText(/付款账户.*¥1,000\.00.*¥400\.00/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*¥800\.00.*¥200\.00/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("还款金额（CNY）"), {
    target: { value: "500" },
  });
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: otherBank.id },
  });
  expect(screen.getByText(/付款账户.*¥1,500\.00.*¥1,000\.00/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: bank.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const saved: Ledger = onSave.mock.calls[0][0];
  const through = "2026-11-06 17:30:00";
  expect(
    projectAccountBalance({ ledger: saved, account: bank, through }).balance,
  ).toBe(50000);
  expect(
    projectAccountBalance({ ledger: saved, account: card, through }).balance,
  ).toBe(30000);
  expect(summarizeAssets({ ledger: saved, through }).netAssets).toBe(
    summarizeAssets({ ledger, through }).netAssets,
  );
  expect(summarize(saved.records).expense).toBe(
    summarize(ledger.records).expense,
  );
  expect(saved.records[0].accountId).toBe(bank.id);
  expect(saved.records[0].transferToAccountId).toBe(card.id);
});

it("does not invent balances when a baseline is absent or the repayment is at the baseline time", () => {
  const { ledger, bank, card } = repaymentLedger();
  const noBaseline = { ...bank, balanceAt: "2026-11-07 00:00:00" };
  const props = {
    ledger: { ...ledger, accounts: [noBaseline, card] },
    account: card,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };
  const { rerender } = render(<AssetTransfer {...props} />);
  enterRepayment(noBaseline);
  expect(screen.queryByText(/净资产不变/)).toBeNull();
  expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
  expect(screen.getByText(/无法预览/)).toBeTruthy();
  const sameTime = { ...bank, balanceAt: "2026-11-06 17:30:00" };
  rerender(
    <AssetTransfer
      {...props}
      ledger={{ ...ledger, accounts: [sameTime, card] }}
    />,
  );
  expect(screen.queryByText(/净资产不变/)).toBeNull();
  expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
});

it.each(["asset", "liability"] as const)(
  "does not claim net assets are unchanged when the %s account was archived at the repayment time",
  async (kind) => {
    const { ledger, bank, card } = repaymentLedger();
    const archiveHistory = [
      { at: "2026-11-01 00:00:00", isArchived: true },
      { at: "2026-11-05 00:00:00", isArchived: false },
    ];
    const source = kind === "asset" ? { ...bank, archiveHistory } : bank;
    const target = kind === "liability" ? { ...card, archiveHistory } : card;
    const currentLedger = { ...ledger, accounts: [source, target] };
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AssetTransfer
        ledger={currentLedger}
        account={target}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    enterRepayment(source);
    const through = "2026-11-02 17:30:00";
    fireEvent.change(screen.getByLabelText("还款时间"), {
      target: { value: through },
    });
    expect(screen.getByText(/还款时间.*已归档.*无法预览/)).toBeTruthy();
    expect(screen.queryByText(/净资产不变/)).toBeNull();
    expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved: Ledger = onSave.mock.calls[0][0];
    const before = summarizeAssets({
      ledger: currentLedger,
      through,
    }).netAssets;
    const after = summarizeAssets({ ledger: saved, through }).netAssets;
    expect(after - before).toBe(kind === "asset" ? 50000 : -50000);
  },
);

it("does not guess cross-currency balances or claim net assets are unchanged", () => {
  const { ledger, bank, card } = repaymentLedger();
  const dollars: AssetAccount = { ...bank, currency: "USD" };
  render(
    <AssetTransfer
      ledger={{ ...ledger, accounts: [dollars, card] }}
      account={card}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  enterRepayment(dollars);
  expect(screen.getByText(/跨币种.*无法预览/)).toBeTruthy();
  expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
  expect(screen.queryByText(/净资产不变/)).toBeNull();
});

it("recalculates immediately when the chosen funding account changes currency", () => {
  const { ledger, bank, otherBank, card } = repaymentLedger();
  const dollars: AssetAccount = { ...otherBank, currency: "USD" };
  render(
    <AssetTransfer
      ledger={{ ...ledger, accounts: [bank, dollars, card] }}
      account={card}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  enterRepayment(bank);
  expect(screen.getByText(/付款账户.*¥1,000\.00.*¥500\.00/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: dollars.id },
  });
  expect(screen.getByText(/跨币种.*无法预览/)).toBeTruthy();
  expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: bank.id },
  });
  expect(screen.getByText(/付款账户.*¥1,000\.00.*¥500\.00/)).toBeTruthy();
});

it("requires a valid rate before showing a same-currency foreign repayment", () => {
  const { ledger, bank, card } = repaymentLedger();
  const dollars: AssetAccount = { ...bank, currency: "USD" };
  const dollarCard: AssetAccount = { ...card, currency: "USD" };
  render(
    <AssetTransfer
      ledger={{ ...ledger, accounts: [dollars, dollarCard] }}
      account={dollarCard}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  enterRepayment(dollars);
  expect(screen.queryByText(/付款账户.*还款后/)).toBeNull();
  fireEvent.change(screen.getByLabelText("1 USD 折合人民币"), {
    target: { value: "7" },
  });
  expect(screen.getByText(/付款账户.*1,000\.00.*500\.00/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*800\.00.*300\.00/)).toBeTruthy();
  expect(screen.getByText(/原币净额不变/)).toBeTruthy();
  expect(screen.queryByText(/净资产不变/)).toBeNull();
});

it("masks both values and liability direction in visual and accessible text and restores them when unhidden", () => {
  const { ledger, bank, card } = repaymentLedger();
  const privateBank = { ...bank, name: "工资 ¥1,000.00" };
  const prepaid = { ...card, name: "信用卡 ¥800.00", openingBalance: -80000 };
  const props = {
    ledger: { ...ledger, accounts: [privateBank, prepaid] },
    account: prepaid,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };
  const { container, rerender } = render(
    <AssetTransfer {...props} isAmountHidden />,
  );
  enterRepayment(privateBank);
  expect(screen.getByText(/当前账户余额.*••••/)).toBeTruthy();
  expect(screen.getByText(/付款账户.*••••.*••••/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*••••.*••••/)).toBeTruthy();
  expect(container.textContent).not.toMatch(/预存|剩余负债|¥|净资产不变/);
  expect(container.querySelector('[aria-label*="¥"]')).toBeNull();
  expect(
    (screen.getByLabelText("付款资产账户") as HTMLSelectElement).value,
  ).toBe(privateBank.id);
  rerender(<AssetTransfer {...props} isAmountHidden={false} />);
  expect(screen.getByText(/当前预存余额.*¥800\.00/)).toBeTruthy();
  expect(screen.getByText(/负债账户.*-¥800\.00.*-¥1,300\.00/)).toBeTruthy();
  expect(screen.getByText(/净资产不变/)).toBeTruthy();
});
