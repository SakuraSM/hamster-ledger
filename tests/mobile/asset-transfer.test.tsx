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
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { AssetAccount, Ledger } from "@hamster-ledger/core";
import { AssetTransfer } from "../../apps/mobile/src/screens/AssetTransfer";
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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
  newEntityId: () => "repayment",
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
    <>
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
      <button onClick={() => onChange(value)}>重选{label}</button>
    </>
  ),
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => <span>交易时间</span>,
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));
afterEach(cleanup);
it("requires a chosen funding asset and records card repayment as a transfer", async () => {
  const example = createDemoLedger();
  const source = example.accounts.find((account) => account.kind === "asset")!;
  const card: AssetAccount = {
    ...source,
    id: "credit",
    name: "信用卡",
    kind: "liability",
    type: "信用卡",
    aliases: [],
    checkpoints: [],
  };
  const ledger = { ...example, accounts: [source, card] };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
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
  fireEvent.change(screen.getByLabelText("还款金额（CNY）"), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() =>
    expect(screen.getByText("请先添加并选择收付款账户。")).toBeTruthy(),
  );
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("付款资产账户"), {
    target: { value: source.id },
  });
  expect(screen.queryByText("请先添加并选择收付款账户。")).toBeNull();
  expect(
    (screen.getByLabelText("还款金额（CNY）") as HTMLInputElement).value,
  ).toBe("10");
  fireEvent.click(screen.getByRole("button", { name: "确认记录还款" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const result: Ledger = onSave.mock.calls[0][0];
  const record = result.records.find((item) => item.id === "repayment");
  expect(record?.kind).toBe("转账");
  expect(record?.detail?.type).toBe("transfer");
  expect(record?.accountId).toBe(source.id);
  expect(record?.transferToAccountId).toBe(card.id);
});

it("allows a liability as the source of a general transfer", async () => {
  const example = createDemoLedger();
  const destination = example.accounts.find(
    (account) => account.kind === "asset",
  )!;
  const card: AssetAccount = {
    ...destination,
    id: "credit-source",
    name: "信用卡",
    kind: "liability",
    type: "信用卡",
    aliases: [],
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AssetTransfer
      ledger={{ ...example, accounts: [destination, card] }}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("转出账户"), {
    target: { value: card.id },
  });
  fireEvent.change(screen.getByLabelText("转入账户"), {
    target: { value: destination.id },
  });
  fireEvent.change(screen.getByLabelText("转出金额（CNY）"), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const result: Ledger = onSave.mock.calls[0][0];
  const record = result.records.find((item) => item.id === "repayment");
  expect(record?.accountId).toBe(card.id);
  expect(record?.transferToAccountId).toBe(destination.id);
});

it("clears a stale foreign received amount when the transfer accounts change", async () => {
  const example = createDemoLedger();
  const base = example.accounts[0];
  const dollars: AssetAccount = {
    ...base,
    id: "usd",
    name: "美元账户",
    currency: "USD",
    aliases: [],
    checkpoints: [],
  };
  const cnySource: AssetAccount = {
    ...base,
    id: "cny-source",
    name: "人民币转出",
    currency: "CNY",
    aliases: [],
    checkpoints: [],
  };
  const cnyDestination: AssetAccount = {
    ...base,
    id: "cny-dest",
    name: "人民币转入",
    currency: "CNY",
    aliases: [],
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AssetTransfer
      ledger={{ ...example, accounts: [dollars, cnySource, cnyDestination] }}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("转出账户"), {
    target: { value: dollars.id },
  });
  fireEvent.change(screen.getByLabelText("转入账户"), {
    target: { value: cnyDestination.id },
  });
  fireEvent.change(screen.getByLabelText("转出金额（USD）"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("1 USD 折合人民币"), {
    target: { value: "7" },
  });
  fireEvent.change(screen.getByLabelText("实际转入金额（CNY）"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("转出账户"), {
    target: { value: cnySource.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const result: Ledger = onSave.mock.calls[0][0];
  const record = result.records.find((item) => item.id === "repayment");
  expect(record?.detail?.destination?.minor).toBe(1000);
});

it("keeps the received amount and rate when reselecting the same accounts", async () => {
  const example = createDemoLedger();
  const base = example.accounts[0];
  const source: AssetAccount = {
    ...base,
    id: "cny-source",
    name: "付款账户",
    currency: "CNY",
    aliases: [],
    checkpoints: [],
  };
  const destination: AssetAccount = {
    ...base,
    id: "usd-dest",
    name: "美元账户",
    currency: "USD",
    aliases: [],
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AssetTransfer
      ledger={{ ...example, accounts: [source, destination] }}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  expect((screen.getByLabelText("转出账户") as HTMLSelectElement).value).toBe(
    "",
  );
  expect((screen.getByLabelText("转入账户") as HTMLSelectElement).value).toBe(
    "",
  );
  fireEvent.change(screen.getByLabelText("转出账户"), {
    target: { value: source.id },
  });
  fireEvent.change(screen.getByLabelText("转入账户"), {
    target: { value: destination.id },
  });
  fireEvent.change(screen.getByLabelText("转出金额（CNY）"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("实际转入金额（USD）"), {
    target: { value: "1.25" },
  });
  fireEvent.change(screen.getByLabelText("转入汇率：1 USD 折合人民币"), {
    target: { value: "7.2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "重选转出账户" }));
  fireEvent.click(screen.getByRole("button", { name: "重选转入账户" }));
  expect(
    (screen.getByLabelText("实际转入金额（USD）") as HTMLInputElement).value,
  ).toBe("1.25");
  expect(
    (screen.getByLabelText("转入汇率：1 USD 折合人民币") as HTMLInputElement)
      .value,
  ).toBe("7.2");
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const result: Ledger = onSave.mock.calls[0][0];
  const record = result.records.find((item) => item.id === "repayment");
  expect(record?.accountId).toBe(source.id);
  expect(record?.transferToAccountId).toBe(destination.id);
  expect(record?.detail?.destination?.minor).toBe(125);
});

it("requires both real accounts before saving a general transfer", async () => {
  const example = createDemoLedger();
  const base = example.accounts[0];
  const source: AssetAccount = {
    ...base,
    id: "source",
    name: "转出账户",
    aliases: [],
    checkpoints: [],
  };
  const destination: AssetAccount = {
    ...base,
    id: "destination",
    name: "转入账户",
    aliases: [],
    checkpoints: [],
  };
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <AssetTransfer
      ledger={{ ...example, accounts: [source, destination] }}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("转出金额（CNY）"), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() =>
    expect(screen.getByText("请先添加并选择收付款账户。")).toBeTruthy(),
  );
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("转出账户"), {
    target: { value: source.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() =>
    expect(screen.getByText("请选择转入账户。")).toBeTruthy(),
  );
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("转入账户"), {
    target: { value: destination.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const result: Ledger = onSave.mock.calls[0][0];
  const record = result.records.find((item) => item.id === "repayment");
  expect(record?.accountId).toBe(source.id);
  expect(record?.transferToAccountId).toBe(destination.id);
});
