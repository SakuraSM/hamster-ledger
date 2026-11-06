// @vitest-environment jsdom
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  projectAccountBalance,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { editLedgerRecord } from "../../packages/ledger-react/src/ledger-actions";
import { RecordMetadataEditor } from "../../apps/mobile/src/screens/RecordMetadataEditor";
import { SavedFilters } from "../../apps/mobile/src/screens/SavedFilters";

vi.mock("@hamster-ledger/ledger-react", () => ({
  useSavedFilters: () => ({
    ready: true,
    presets: [],
    error: "",
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));
vi.mock("../../apps/mobile/src/platform/storage", () => ({ nativeStore: {} }));

vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  Checkbox: {
    Item: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <button onClick={onPress}>{label}</button>
    ),
  },
  TextInput: ({ label }: { label: string }) => <input aria-label={label} />,
  List: {
    Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Icon: () => null,
  },
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
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  }) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ title, children }: { title: string; children: ReactNode }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) => <span>{message}</span>,
}));
afterEach(cleanup);

const bank: AssetAccount = {
  id: "bank",
  name: "工资卡",
  kind: "asset",
  type: "银行卡",
  openingBalance: 100000,
  balanceAt: "2026-09-01 00:00:00",
  aliases: ["招商银行 · 6628"],
  isArchived: false,
  checkpoints: [],
};
function bill(input: Partial<BillRecord> = {}): BillRecord {
  return {
    id: "bill",
    date: "2026-09-10 12:00:00",
    merchant: "虚拟支出",
    description: "",
    amount: 5000,
    currency: "CNY",
    kind: "支出",
    category: "其他",
    source: "支付宝",
    account: bank.aliases[0],
    orderId: "virtual",
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "virtual.csv",
    raw: {},
    linkedSources: [],
    ...input,
  };
}
function setup(record: BillRecord): {
  ledger: () => Ledger;
  onClose: ReturnType<typeof vi.fn>;
} {
  let current: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bank],
    records: [
      record,
      bill({ id: "duplicate", status: "duplicate", duplicateOf: record.id }),
    ],
  };
  const controller = {
    ledger: current,
    isSaving: false,
    editRecord: async (input: Parameters<typeof editLedgerRecord>[1]) => {
      current = editLedgerRecord(current, input);
    },
  } as LedgerController;
  const onClose = vi.fn();
  render(
    <RecordMetadataEditor
      record={record}
      controller={controller}
      onClose={onClose}
    />,
  );
  return { ledger: () => current, onClose };
}
async function save(onClose: ReturnType<typeof vi.fn>): Promise<void> {
  fireEvent.change(screen.getByRole("combobox", { name: "分类" }), {
    target: { value: "餐饮" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
}
function balance(ledger: Ledger): number {
  return projectAccountBalance({
    ledger,
    account: bank,
    through: "2026-09-30 23:59:59",
  }).balance;
}

describe("native metadata account selection", () => {
  it.each([bank.name, bank.aliases[0]])(
    "preserves an existing name or alias match for %s when only category changes",
    async (account) => {
      const { ledger, onClose } = setup(bill({ account }));
      expect(
        screen.getByRole("combobox", { name: "关联资产账户" }),
      ).toHaveProperty("value", bank.id);
      await save(onClose);
      expect(ledger().records[0].accountId).toBeUndefined();
      expect(ledger().records[0].category).toBe("餐饮");
      expect(balance(ledger())).toBe(95000);
    },
  );

  it("keeps an explicitly unlinked account unlinked", async () => {
    const { ledger, onClose } = setup(bill({ accountId: null }));
    await save(onClose);
    expect(ledger().records[0].accountId).toBeNull();
    expect(balance(ledger())).toBe(100000);
  });

  it("preserves automatic matching for an unresolved legacy account", async () => {
    const { ledger, onClose } = setup(bill({ account: "尚未建立的账户" }));
    await save(onClose);
    expect(ledger().records[0].accountId).toBeUndefined();
    const newAccount = {
      ...bank,
      id: "new-account",
      name: "尚未建立的账户",
      aliases: [],
    };
    const later = { ...ledger(), accounts: [bank, newAccount] };
    expect(
      projectAccountBalance({
        ledger: later,
        account: newAccount,
        through: "2026-09-30 23:59:59",
      }).balance,
    ).toBe(95000);
  });

  it("allows an explicit unlink to override an existing alias match", async () => {
    const { ledger, onClose } = setup(bill());
    fireEvent.change(screen.getByRole("combobox", { name: "关联资产账户" }), {
      target: { value: "" },
    });
    await save(onClose);
    expect(ledger().records[0].accountId).toBeNull();
    expect(balance(ledger())).toBe(100000);
  });

  it("allows an explicitly unlinked bill to be assigned to an account", async () => {
    const { ledger, onClose } = setup(bill({ accountId: null }));
    fireEvent.change(screen.getByRole("combobox", { name: "关联资产账户" }), {
      target: { value: bank.id },
    });
    await save(onClose);
    expect(ledger().records[0].accountId).toBe(bank.id);
    expect(balance(ledger())).toBe(95000);
  });
});

it("applies the pending filter from the Android reimbursement shortcut", () => {
  const onApply = vi.fn();
  render(
    <SavedFilters
      bookId="native:personal"
      filter={{}}
      position={0}
      onApply={onApply}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "待报销" }));
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      position: 0,
      filter: expect.objectContaining({ reimbursement: "pending" }),
    }),
  );
});
