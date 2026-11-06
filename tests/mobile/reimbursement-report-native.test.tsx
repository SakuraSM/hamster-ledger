// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  DEFAULT_PREFERENCES,
  EMPTY_LEDGER,
  createLedgerRepository,
  migrateLedger,
  saveAdvancedEntry,
  type AdvancedEntryInput,
  type BillRecord,
  type Ledger,
  type LedgerRepository,
} from "@hamster-ledger/core";
import { useLedger } from "../../packages/ledger-react/src/useLedger";
import { ReportsScreen } from "../../apps/mobile/src/screens/ReportsScreen";
import { EntryEditor } from "../../apps/mobile/src/screens/EntryEditor";
const { client } = vi.hoisted(() => ({ client: { request: vi.fn() } }));
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
    accessibilityLabel,
    disabled,
  }: {
    children: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={onPress}
    >
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
  Checkbox: { Item: () => null },
  SegmentedButtons: () => null,
  ProgressBar: () => null,
}));
vi.mock("../../apps/mobile/src/ui/AmountText", () => ({
  AmountText: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  useAmountColors: () => ({ income: "#444", expense: "#444", neutral: "#444" }),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  Section: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
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
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ title, children }: { title: string; children: ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => null,
}));
vi.mock("../../apps/mobile/src/ui/ReportRangePresets", () => ({
  ReportRangePresets: () => null,
}));
vi.mock("../../apps/mobile/src/screens/NetWorthReport", () => ({
  NetWorthReport: () => null,
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client }),
}));
vi.mock("../../apps/mobile/src/screens/ReceiptAction", () => ({
  ReceiptAction: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-10-10 12:00:00",
  newEntityId: () => "new-reimbursement",
}));
afterEach(cleanup);
function entry(
  id: string,
  amount: number,
  type: "expense" | "reimburse",
  relatedId?: string,
): AdvancedEntryInput {
  return {
    id,
    date: "2026-10-05 12:00:00",
    merchant: id === "expense" ? "办公用品 200.00" : "已有回款",
    category: "购物",
    accountId: "cash",
    detail: {
      type,
      original: {
        currency: "CNY",
        minor: amount,
        rate: "1",
        date: "2026-10-05",
        source: "manual",
      },
      relatedId,
      isReimbursable: type === "expense",
      splits: [],
      movements: [],
      attachmentIds: [],
      origin: "manual",
    },
  };
}
function fixture(hidden = false): Ledger {
  let ledger = migrateLedger({
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name: "现金账户",
        kind: "asset",
        type: "现金",
        openingBalance: 100000,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        isArchived: false,
        checkpoints: [],
      },
    ],
    preferences: { ...DEFAULT_PREFERENCES, hideAmounts: hidden },
  });
  ledger = saveAdvancedEntry(ledger, entry("expense", 20000, "expense"));
  return saveAdvancedEntry(
    ledger,
    entry("received", 8000, "reimburse", "expense"),
  );
}
function Harness({
  initial,
  onRecord,
  onSaved,
}: {
  initial: Ledger;
  onRecord: (record: BillRecord) => void;
  onSaved: (ledger: Ledger) => void;
}): React.JSX.Element {
  const [ledger, setLedger] = useState(initial);
  const [relatedId, setRelatedId] = useState("");
  return (
    <>
      <ReportsScreen
        ledger={ledger}
        onRecord={onRecord}
        onReimburse={(record) => setRelatedId(record.id)}
      />
      {relatedId ? (
        <EntryEditor
          ledger={ledger}
          initialDraft={{
            type: "reimburse",
            relatedId,
            accountId: "",
            amount: "",
          }}
          onCommit={async (next) => {
            setLedger(next);
            onSaved(next);
          }}
          onSave={async () => {}}
          onClose={() => setRelatedId("")}
        />
      ) : null}
    </>
  );
}
function ControllerHarness({
  repository,
}: {
  repository: LedgerRepository;
}): React.JSX.Element {
  const controller = useLedger({
    repository,
    createDemoLedger: () => EMPTY_LEDGER,
    localNow: () => "2026-10-10 12:00:00",
    newEntityId: () => "test-id",
  });
  const [relatedId, setRelatedId] = useState("");
  if (controller.isLoading) return <span>正在加载</span>;
  return (
    <>
      <ReportsScreen
        ledger={controller.ledger}
        onRecord={() => {}}
        onReimburse={(record) => setRelatedId(record.id)}
      />
      {relatedId ? (
        <EntryEditor
          ledger={controller.ledger}
          initialDraft={{
            type: "reimburse",
            relatedId,
            accountId: "",
            amount: "",
          }}
          onCommit={async (next) => controller.commit(next)}
          onSave={async () => {}}
          onClose={() => setRelatedId("")}
        />
      ) : null}
    </>
  );
}
describe("Android reimbursement report", () => {
  it("hides conflicting amounts and keeps real anomaly records accessible", () => {
    const ledger = fixture();
    const received = ledger.records.find((record) => record.id === "received")!;
    ledger.records.push({
      ...received,
      id: "conflict",
      duplicateOf: "received",
    });
    const onRecord = vi.fn();
    render(<Harness initial={ledger} onRecord={onRecord} onSaved={vi.fn()} />);
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getAllByText("数据状态需核对").length).toBeGreaterThan(0);
    expect(report.queryByText(/¥120\.00|¥80\.00|¥200\.00/)).toBeNull();
    expect(report.queryByRole("button", { name: "记录回款 1" })).toBeNull();
    fireEvent.click(report.getByRole("button", { name: "查看异常关联 1-1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "conflict" }),
    );
  });
  it("keeps conflicting merchant and amount text out of hidden-mode accessibility labels", () => {
    const ledger = fixture(true);
    const received = ledger.records.find((record) => record.id === "received")!;
    ledger.records.push({
      ...received,
      id: "conflict",
      detail: { ...received.detail!, type: "expense" },
    });
    render(<Harness initial={ledger} onRecord={vi.fn()} onSaved={vi.fn()} />);
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getAllByText("数据状态需核对").length).toBeGreaterThan(0);
    expect(report.queryByText(/办公用品|200\.00|120\.00|80\.00/)).toBeNull();
    const anomaly = report.getByRole("button", { name: "查看异常关联 1-1" });
    expect(anomaly.getAttribute("aria-label")).not.toMatch(
      /办公用品|200\.00|80\.00/,
    );
    expect(report.queryByRole("button", { name: "记录回款 1" })).toBeNull();
  });
  it("shows historical outstanding but blocks a fully settled current balance", () => {
    let ledger = fixture();
    const later = entry("later", 12000, "reimburse", "expense");
    later.date = "2026-11-05 12:00:00";
    ledger = saveAdvancedEntry(ledger, later);
    const onRecord = vi.fn();
    render(<Harness initial={ledger} onRecord={onRecord} onSaved={vi.fn()} />);
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getByText("待回款 · ¥120.00")).toBeTruthy();
    expect(report.getByText(/^当前可继续记录上限：/).textContent).toContain(
      "¥0.00",
    );
    expect(report.queryByRole("button", { name: "记录回款 1" })).toBeNull();
    fireEvent.click(
      report.getByRole("button", { name: "查看截止日后回款 1-1" }),
    );
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "later" }),
    );
  });
  it("shows real totals and opens the corresponding original and repayment", () => {
    const onRecord = vi.fn();
    render(
      <Harness initial={fixture()} onRecord={onRecord} onSaved={vi.fn()} />,
    );
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getByText("待回款 · ¥120.00")).toBeTruthy();
    expect(report.getByText("已回款 · ¥80.00")).toBeTruthy();
    fireEvent.click(report.getByRole("button", { name: "查看原支出 1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "expense" }),
    );
    fireEvent.click(report.getByRole("button", { name: "查看回款 1-1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "received" }),
    );
  });
  it("opens an unfilled related reimbursement draft and saves an explicit amount and account", async () => {
    const onSaved = vi.fn();
    render(
      <Harness initial={fixture()} onRecord={vi.fn()} onSaved={onSaved} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "记录回款 1" }));
    const dialog = within(screen.getByRole("dialog", { name: "完整交易记账" }));
    expect((dialog.getByLabelText("交易类型") as HTMLSelectElement).value).toBe(
      "reimburse",
    );
    expect(
      (dialog.getByLabelText("关联原支出") as HTMLSelectElement).value,
    ).toBe("expense");
    expect(
      (dialog.getByLabelText("收付款账户") as HTMLSelectElement).value,
    ).toBe("");
    expect(
      (dialog.getByLabelText("原币金额（CNY）") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.change(dialog.getByLabelText("商户 / 交易名称"), {
      target: { value: "公司报销" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存完整交易" }));
    await waitFor(() =>
      expect(dialog.getByRole("alert").textContent).toMatch(/账户/),
    );
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.change(dialog.getByLabelText("收付款账户"), {
      target: { value: "cash" },
    });
    fireEvent.change(dialog.getByLabelText("原币金额（CNY）"), {
      target: { value: "40" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存完整交易" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(
      onSaved.mock.calls[0][0].records.find(
        (record: BillRecord) => record.id === "new-reimbursement",
      ),
    ).toMatchObject({
      kind: "退款",
      accountId: "cash",
      amount: 4000,
      detail: { type: "reimburse", relatedId: "expense" },
    });
  });
  it("masks amounts and merchants, including related choice names, but keeps the real linked ID", () => {
    const view = render(
      <Harness initial={fixture(true)} onRecord={vi.fn()} onSaved={vi.fn()} />,
    );
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.queryByText(/办公用品|200\.00|120\.00|80\.00/)).toBeNull();
    expect(report.getAllByText(/••••/).length).toBeGreaterThan(0);
    fireEvent.click(report.getByRole("button", { name: "记录回款 1" }));
    const dialog = within(screen.getByRole("dialog", { name: "完整交易记账" }));
    const related = dialog.getByLabelText("关联原支出") as HTMLSelectElement;
    expect(related.value).toBe("expense");
    expect(related.textContent).not.toMatch(/办公用品|200\.00/);
    view.unmount();
    render(
      <Harness initial={fixture(false)} onRecord={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByText("办公用品 200.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "记录回款 1" }));
    const visible = within(
      screen.getByRole("dialog", { name: "完整交易记账" }),
    );
    expect(
      (visible.getByLabelText("关联原支出") as HTMLSelectElement).value,
    ).toBe("expense");
    expect(visible.getByLabelText("关联原支出").textContent).toContain(
      "办公用品 200.00",
    );
  });
  it("persists a related repayment through the real local ledger controller", async () => {
    const values = new Map<string, string>();
    const repository = createLedgerRepository({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        values.set(key, value);
      },
    });
    await repository.save("personal", fixture());
    await repository.saveActiveMode("personal");
    render(<ControllerHarness repository={repository} />);
    fireEvent.click(await screen.findByRole("button", { name: "记录回款 1" }));
    const dialog = within(screen.getByRole("dialog", { name: "完整交易记账" }));
    fireEvent.change(dialog.getByLabelText("商户 / 交易名称"), {
      target: { value: "公司报销" },
    });
    fireEvent.change(dialog.getByLabelText("收付款账户"), {
      target: { value: "cash" },
    });
    fireEvent.change(dialog.getByLabelText("原币金额（CNY）"), {
      target: { value: "40" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存完整交易" }));
    await waitFor(async () =>
      expect(
        (await repository.load("personal"))?.records.find(
          (record) => record.id === "new-reimbursement",
        ),
      ).toMatchObject({
        accountId: "cash",
        amount: 4000,
        detail: { type: "reimburse", relatedId: "expense" },
      }),
    );
  });
});
