// @vitest-environment jsdom
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { AssetAccount, BillRecord, Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { AssetsScreen } from "../../apps/mobile/src/screens/AssetsScreen";

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: <Styles,>(styles: Styles): Styles => styles },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({ colors: { onSurfaceVariant: "#555" } }),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
}));
vi.mock("@hamster-ledger/ledger-react", () => ({
  useAssetSummary: () => ({
    totals: {
      balances: [],
      assets: 0,
      liabilities: 0,
      netAssets: 0,
      missingCurrencies: [],
      missingBaselines: [],
    },
    comparison: {
      accountChanges: {},
      unavailableAccounts: [],
      netChange: null,
      previousDate: "2026-10-31",
    },
    rates: { rates: [] },
  }),
}));
vi.mock("../../apps/mobile/src/platform/runtime", () => ({
  localNow: () => "2026-11-06 17:30:00",
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({ client: {} }),
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  Screen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  ErrorMessage: () => null,
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => null,
}));
vi.mock("../../apps/mobile/src/screens/AssetSummary", () => ({
  AssetSummary: () => <span>资产</span>,
}));
vi.mock("../../apps/mobile/src/screens/AssetAccountList", () => ({
  AssetAccountList: ({
    ledger,
    onSelect,
  }: {
    ledger: Ledger;
    onSelect: (id: string) => void;
  }) => (
    <>
      {ledger.accounts.map((account) => (
        <button key={account.id} onClick={() => onSelect(account.id)}>
          {account.name}
        </button>
      ))}
    </>
  ),
}));
vi.mock("../../apps/mobile/src/screens/AssetAccountDetail", () => ({
  AssetAccountDetail: ({
    account,
    onTransfer,
    onCalibrate,
    onArchive,
    initialHistoryMode = "changes",
  }: {
    account: AssetAccount;
    onTransfer: () => void;
    onCalibrate: () => void;
    onArchive: () => void;
    initialHistoryMode?: "changes" | "records";
  }) => (
    <section>
      <span>账户详情 {account.id}</span>
      <span>账户标签 {initialHistoryMode}</span>
      <button onClick={onTransfer}>记录还款</button>
      <button onClick={onCalibrate}>核对余额</button>
      <button onClick={onArchive}>归档账户</button>
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/screens/AssetTransfer", () => ({
  AssetTransfer: ({
    account,
    onClose,
  }: {
    account?: AssetAccount;
    onClose: () => void;
  }) => (
    <section>
      <span>转账账户 {account?.id}</span>
      <button onClick={onClose}>关闭转账</button>
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/screens/RecordRow", () => ({
  RecordRow: ({
    record,
    onPress,
  }: {
    record: BillRecord;
    onPress: (record: BillRecord) => void;
  }) => <button onClick={() => onPress(record)}>{record.merchant}</button>,
}));
vi.mock("../../apps/mobile/src/screens/AccountEditor", () => ({
  AccountEditor: () => null,
}));
vi.mock("../../apps/mobile/src/screens/BalanceCalibration", () => ({
  BalanceCalibration: ({
    account,
    onClose,
    onFindRecords,
  }: {
    account: AssetAccount;
    onClose: () => void;
    onFindRecords: () => void;
  }) => (
    <section>
      <span>校准 {account.id}</span>
      <button onClick={onClose}>普通返回</button>
      <button onClick={onFindRecords}>先查找遗漏账单</button>
    </section>
  ),
}));
vi.mock("../../apps/mobile/src/screens/NetWorthReport", () => ({
  NetWorthReport: () => <span>趋势图已打开</span>,
}));
vi.mock("../../apps/mobile/src/screens/ValuationRates", () => ({
  ValuationRates: () => null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function controllerFor(ledger: Ledger): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    mode: "personal",
    books: [],
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: vi.fn(),
    updateBooks: vi.fn(),
    switchMode: vi.fn(),
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}

it("opens an unassigned bill from the real asset reminder", () => {
  const example = createDemoLedger();
  const record: BillRecord = {
    ...example.records[0],
    id: "unlinked",
    merchant: "待关联账单",
    status: "confirmed",
    kind: "支出",
    accountId: null,
    detail: undefined,
    isDeleted: false,
  };
  const onRecord = vi.fn();
  render(
    <AssetsScreen
      controller={controllerFor({ ...example, records: [record] })}
      onRecord={onRecord}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "1 条已确认账单尚未关联账户" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "待关联账单" }));
  expect(onRecord).toHaveBeenCalledWith(record);
});

it("passes the selected account ID into repayment and returns to that account", () => {
  const example = createDemoLedger();
  const card: AssetAccount = {
    ...example.accounts[0],
    id: "card-123",
    name: "信用卡",
    kind: "liability",
    type: "信用卡",
    aliases: [],
    checkpoints: [],
  };
  render(
    <AssetsScreen
      controller={controllerFor({ ...example, records: [], accounts: [card] })}
      onRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "信用卡" }));
  expect(screen.getByText("账户详情 card-123")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "记录还款" }));
  expect(screen.getByText("转账账户 card-123")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "关闭转账" }));
  expect(screen.getByText("账户详情 card-123")).toBeTruthy();
});

it("finds missed records for the same account while a normal calibration close returns to changes", () => {
  const example = createDemoLedger();
  const account: AssetAccount = {
    ...example.accounts[0],
    id: "selected-account",
    name: "我的现金",
    aliases: [],
  };
  const other: AssetAccount = {
    ...account,
    id: "other-account",
    name: "另一个账户",
  };
  render(
    <AssetsScreen
      controller={controllerFor({
        ...example,
        records: [],
        accounts: [account, other],
      })}
      onRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "我的现金" }));
  fireEvent.click(screen.getByRole("button", { name: "核对余额" }));
  expect(screen.getByText("校准 selected-account")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "先查找遗漏账单" }));
  expect(screen.getByText("账户详情 selected-account")).toBeTruthy();
  expect(screen.getByText("账户标签 records")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "核对余额" }));
  fireEvent.click(screen.getByRole("button", { name: "普通返回" }));
  expect(screen.getByText("账户详情 selected-account")).toBeTruthy();
  expect(screen.getByText("账户标签 changes")).toBeTruthy();
});

it("archives the current ledger after a concurrent refresh rather than an old snapshot", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const initial = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  const view = render(<AssetsScreen controller={initial} onRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  expect(confirm?.onPress).toBeDefined();
  const newerRecord = { ...example.records[0], id: "concurrent-new-record" };
  const latest = controllerFor({
    ...example,
    records: [newerRecord],
    accounts: [account],
  });
  view.rerender(<AssetsScreen controller={latest} onRecord={vi.fn()} />);
  confirm?.onPress?.();
  await waitFor(() => expect(latest.commit).toHaveBeenCalledOnce());
  const saved = vi.mocked(latest.commit).mock.calls[0][0];
  expect(saved.records.map((record) => record.id)).toContain(newerRecord.id);
  expect(
    saved.accounts.find((item) => item.id === account.id)?.isArchived,
  ).toBe(true);
  expect(initial.commit).not.toHaveBeenCalled();
});

it("rejects a stale archive confirmation after the book or account state changed", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const initial = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  initial.books = [
    {
      id: "personal",
      name: "联网账本",
      cloud: {
        id: "cloud-a",
        server: "https://first.example",
        userId: "user-a",
        role: "owner",
      },
    },
  ];
  const view = render(<AssetsScreen controller={initial} onRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  const changed = controllerFor({
    ...example,
    records: [],
    accounts: [{ ...account, isArchived: true }],
  });
  changed.books = [
    {
      id: "personal",
      name: "另一账本",
      cloud: {
        id: "cloud-b",
        server: "https://second.example",
        userId: "user-b",
        role: "owner",
      },
    },
  ];
  view.rerender(<AssetsScreen controller={changed} onRecord={vi.fn()} />);
  confirm?.onPress?.();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  expect(initial.commit).not.toHaveBeenCalled();
  expect(changed.commit).not.toHaveBeenCalled();
});

it("opens historical trends after the last account was archived", () => {
  const example = createDemoLedger();
  const account: AssetAccount = {
    ...example.accounts[0],
    id: "archived",
    name: "已归档账户",
    isArchived: true,
    archiveHistory: [{ at: "2026-10-15 12:00:00", isArchived: true }],
  };
  render(
    <AssetsScreen
      controller={controllerFor({
        ...example,
        records: [],
        accounts: [account],
      })}
      onRecord={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "查看净资产趋势" }));
  expect(screen.getByText("趋势图已打开")).toBeTruthy();
});

it("rejects the confirmation if the same account was already archived during refresh", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const initial = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  const view = render(<AssetsScreen controller={initial} onRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  const changed = controllerFor({
    ...example,
    records: [],
    accounts: [{ ...account, isArchived: true }],
  });
  view.rerender(<AssetsScreen controller={changed} onRecord={vi.fn()} />);
  confirm?.onPress?.();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  expect(vi.mocked(Alert.alert).mock.calls[1][1]).toContain("账户状态已变化");
  expect(changed.commit).not.toHaveBeenCalled();
});

it("rejects confirmation if a different user opens the same cloud ledger", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const initial = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  initial.books = [
    {
      id: "personal",
      name: "联网账本",
      cloud: {
        id: "cloud-a",
        server: "https://first.example",
        userId: "user-a",
        role: "owner",
      },
    },
  ];
  const view = render(<AssetsScreen controller={initial} onRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  const changed = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  changed.books = [
    {
      id: "personal",
      name: "联网账本",
      cloud: {
        id: "cloud-a",
        server: "https://first.example",
        userId: "user-b",
        role: "owner",
      },
    },
  ];
  view.rerender(<AssetsScreen controller={changed} onRecord={vi.fn()} />);
  confirm?.onPress?.();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  expect(changed.commit).not.toHaveBeenCalled();
});

it("passes the latest cloud identity and revision when an archive is confirmed", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const controller = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  controller.books = [
    {
      id: "personal",
      name: "联网账本",
      cloud: {
        id: "cloud",
        server: "https://server.example",
        userId: "user-a",
        role: "owner",
      },
    },
  ];
  controller.network = {
    isConnected: true,
    isOnline: true,
    revision: 8,
    error: "",
    refresh: vi.fn(),
  };
  render(<AssetsScreen controller={controller} onRecord={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  confirm?.onPress?.();
  await waitFor(() => expect(controller.commit).toHaveBeenCalledOnce());
  expect(vi.mocked(controller.commit).mock.calls[0][1]).toEqual({
    mode: "personal",
    expectedRevision: 8,
    expectedCloud: {
      id: "cloud",
      server: "https://server.example",
      userId: "user-a",
    },
  });
});

it("rejects an archive alert that outlives the asset screen", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "archive-target",
    name: "待归档账户",
    isArchived: false,
  };
  const controller = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  const view = render(
    <AssetsScreen controller={controller} onRecord={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "待归档账户" }));
  fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
  const confirm = vi
    .mocked(Alert.alert)
    .mock.calls[0][2]?.find((item) => item.text === "确认");
  view.unmount();
  confirm?.onPress?.();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  expect(controller.commit).not.toHaveBeenCalled();
});
