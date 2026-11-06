// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./helpers/render";
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
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { ReportsPage } from "../apps/web/src/components/planning/ReportsPage";
import { EntryEditor } from "../apps/web/src/components/EntryEditor";

const { client } = vi.hoisted(() => ({ client: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => client,
}));
vi.mock("../apps/web/src/platform/browser/runtime", async (original) => ({
  ...(await original<
    typeof import("../apps/web/src/platform/browser/runtime")
  >()),
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
      <ReportsPage
        ledger={ledger}
        month="2026-10"
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
  if (controller.isLoading) return <p>正在加载</p>;
  return (
    <>
      <ReportsPage
        ledger={controller.ledger}
        month="2026-10"
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
describe("Web reimbursement report", () => {
  it("hides misleading values and disables repayment for conflicting duplicate data while retaining record access", () => {
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
    fireEvent.click(report.getByRole("button", { name: "查看原支出 1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "expense" }),
    );
    fireEvent.click(report.getByRole("button", { name: "查看异常关联 1-1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "conflict" }),
    );
  });
  it("keeps conflicting record and merchant values hidden in accessible report controls", () => {
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
  it("distinguishes historical outstanding from the current limit and links later returns", () => {
    let ledger = fixture();
    const later = entry("later", 12000, "reimburse", "expense");
    later.date = "2026-11-05 12:00:00";
    ledger = saveAdvancedEntry(ledger, later);
    const onRecord = vi.fn();
    render(<Harness initial={ledger} onRecord={onRecord} onSaved={vi.fn()} />);
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getByText("¥120.00")).toBeTruthy();
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
  it("shows real totals and opens both the original and its return", () => {
    const ledger = fixture();
    const onRecord = vi.fn();
    render(<Harness initial={ledger} onRecord={onRecord} onSaved={vi.fn()} />);
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.getByText("¥120.00")).toBeTruthy();
    expect(report.getByText("¥80.00")).toBeTruthy();
    fireEvent.click(report.getByRole("button", { name: "查看原支出 1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "expense" }),
    );
    fireEvent.click(report.getByRole("button", { name: "查看回款 1-1" }));
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "received" }),
    );
  });
  it("opens a related reimbursement draft without selecting an account or amount, then saves the actual link", async () => {
    const onSaved = vi.fn();
    render(
      <Harness initial={fixture()} onRecord={vi.fn()} onSaved={onSaved} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "记录回款 1" }));
    const dialog = within(screen.getByRole("dialog", { name: "完整交易记账" }));
    expect(
      (dialog.getByRole("combobox", { name: "交易类型" }) as HTMLInputElement)
        .value,
    ).toBe("报销回款");
    expect(
      (dialog.getByRole("combobox", { name: "关联原支出" }) as HTMLInputElement)
        .value,
    ).toContain("办公用品");
    expect(
      (dialog.getByRole("combobox", { name: "收付款账户" }) as HTMLInputElement)
        .value,
    ).not.toContain("现金账户");
    expect(
      (dialog.getByRole("textbox", { name: /原币金额/ }) as HTMLInputElement)
        .value,
    ).toBe("");
    fireEvent.change(dialog.getByRole("textbox", { name: /商户/ }), {
      target: { value: "公司报销" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存完整交易" }));
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("combobox", { name: "收付款账户" }));
    fireEvent.click(screen.getByRole("option", { name: /现金账户/ }));
    fireEvent.change(dialog.getByRole("textbox", { name: /原币金额/ }), {
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
    fireEvent.change(dialog.getByRole("textbox", { name: /商户/ }), {
      target: { value: "公司报销" },
    });
    fireEvent.click(dialog.getByRole("combobox", { name: "收付款账户" }));
    fireEvent.click(screen.getByRole("option", { name: /现金账户/ }));
    fireEvent.change(dialog.getByRole("textbox", { name: /原币金额/ }), {
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
  it("masks totals, merchant text and accessible names in hidden mode, restoring them when unhidden", () => {
    const onRecord = vi.fn();
    const onSaved = vi.fn();
    const view = render(
      <Harness initial={fixture(true)} onRecord={onRecord} onSaved={onSaved} />,
    );
    const report = within(screen.getByRole("region", { name: "回款与分摊" }));
    expect(report.queryByText(/办公用品|200\.00|120\.00|80\.00/)).toBeNull();
    expect(report.getAllByText("••••").length).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "查看原支出 1" })
        .getAttribute("aria-label"),
    ).not.toContain("办公用品");
    fireEvent.click(report.getByRole("button", { name: "记录回款 1" }));
    const dialog = within(screen.getByRole("dialog", { name: "完整交易记账" }));
    const related = dialog.getByRole("combobox", {
      name: "关联原支出",
    }) as HTMLInputElement;
    expect(related.value).toBe("原支出 1");
    fireEvent.click(related);
    expect(
      screen.queryByRole("option", { name: /办公用品|200\.00/ }),
    ).toBeNull();
    view.unmount();
    render(
      <Harness
        initial={fixture(false)}
        onRecord={onRecord}
        onSaved={onSaved}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "回款与分摊" })).getByText(
        "办公用品 200.00",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "记录回款 1" }));
    expect(
      (
        within(screen.getByRole("dialog", { name: "完整交易记账" })).getByRole(
          "combobox",
          { name: "关联原支出" },
        ) as HTMLInputElement
      ).value,
    ).toContain("办公用品 200.00");
  });
});
