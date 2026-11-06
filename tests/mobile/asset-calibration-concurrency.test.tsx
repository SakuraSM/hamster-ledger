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
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { BalanceCalibration } from "../../apps/mobile/src/screens/BalanceCalibration";
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("react-native-paper", () => ({
  useTheme: () => ({
    dark: false,
    colors: {
      onSurfaceVariant: "#555",
      surfaceVariant: "#eee",
      outlineVariant: "#ccc",
    },
  }),
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
  newEntityId: () => "checkpoint-test",
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => <span>余额确认时间</span>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
}));
afterEach(cleanup);
function controllerFor(ledger: Ledger, revision?: number): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    books:
      revision === undefined
        ? []
        : [
            {
              id: "personal",
              name: "联网账本",
              cloud: {
                id: "cloud-test",
                server: "https://server.example",
                userId: "user-a",
                role: "owner",
              },
            },
          ],
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    ...(revision === undefined
      ? {}
      : {
          network: {
            isConnected: true,
            isOnline: true,
            revision,
            error: "",
            refresh: vi.fn(),
          },
        }),
    createBook: vi.fn(),
    updateBooks: vi.fn(),
    switchMode: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
function fixture(): { ledger: Ledger; account: AssetAccount } {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "cash",
    name: "现金",
    currency: "CNY" as const,
    aliases: [],
    checkpoints: [],
    openingBalance: 100000,
    balanceAt: "2026-10-01 00:00:00",
  };
  return { ledger: { ...example, records: [], accounts: [account] }, account };
}
function enterPreview(): void {
  fireEvent.change(screen.getByLabelText("实际余额"), {
    target: { value: "123.45" },
  });
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
}
it("keeps the draft when the remote revision changes after preview and uses the new revision after re-preview", async () => {
  const { ledger, account } = fixture();
  const onClose = vi.fn();
  const first = controllerFor(ledger, 1);
  const view = render(
    <BalanceCalibration
      controller={first}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  const newer = controllerFor(ledger, 2);
  view.rerender(
    <BalanceCalibration
      controller={newer}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("账本版本已变化"),
  );
  expect(newer.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
  expect((screen.getByLabelText("实际余额") as HTMLInputElement).value).toBe(
    "123.45",
  );
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() => expect(newer.commit).toHaveBeenCalledOnce());
  const [saved, options] = vi.mocked(newer.commit).mock.calls[0];
  expect(options).toEqual({
    mode: "personal",
    expectedRevision: 2,
    expectedCloud: {
      id: "cloud-test",
      server: "https://server.example",
      userId: "user-a",
    },
  });
  expect(saved.accounts[0].openingBalance).toBe(12345);
});
it("rejects a changed account through the real core and retains the draft", async () => {
  const { ledger, account } = fixture();
  const onClose = vi.fn();
  const view = render(
    <BalanceCalibration
      controller={controllerFor(ledger)}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  const latest = controllerFor({
    ...ledger,
    accounts: [{ ...account, openingBalance: 200000 }],
  });
  view.rerender(
    <BalanceCalibration
      controller={latest}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("账户已发生变化"),
  );
  expect(latest.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
  expect((screen.getByLabelText("实际余额") as HTMLInputElement).value).toBe(
    "123.45",
  );
});
it("saves a local calibration without passing revision options", async () => {
  const { ledger, account } = fixture();
  const controller = controllerFor(ledger);
  render(
    <BalanceCalibration
      controller={controller}
      account={account}
      date="2026-11-06"
      onClose={vi.fn()}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() => expect(controller.commit).toHaveBeenCalledOnce());
  expect(vi.mocked(controller.commit).mock.calls[0]).toHaveLength(1);
});

it("rejects a same-revision calibration when the cloud user changed", async () => {
  const { ledger, account } = fixture();
  const first = controllerFor(ledger, 1);
  first.books = [
    {
      id: "personal",
      name: "云账本",
      cloud: {
        id: "cloud",
        server: "https://server.example",
        userId: "user-a",
        role: "owner",
      },
    },
  ];
  const onClose = vi.fn();
  const view = render(
    <BalanceCalibration
      controller={first}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  const changed = controllerFor(ledger, 1);
  changed.books = [
    {
      id: "personal",
      name: "云账本",
      cloud: {
        id: "cloud",
        server: "https://server.example",
        userId: "user-b",
        role: "owner",
      },
    },
  ];
  view.rerender(
    <BalanceCalibration
      controller={changed}
      account={account}
      date="2026-11-06"
      onClose={onClose}
      onFindRecords={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("账本已切换"),
  );
  expect(changed.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it("does not preview or commit a network revision without a cloud identity", () => {
  const { ledger, account } = fixture();
  const controller = controllerFor(ledger, 1);
  controller.books = [];
  render(
    <BalanceCalibration
      controller={controller}
      account={account}
      date="2026-11-06"
      onClose={vi.fn()}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  expect(screen.getByRole("alert").textContent).toContain("联网账本身份不可用");
  expect(screen.queryByRole("button", { name: "确认保存新基准" })).toBeNull();
  expect(controller.commit).not.toHaveBeenCalled();
  expect((screen.getByLabelText("实际余额") as HTMLInputElement).value).toBe(
    "123.45",
  );
});

it("retains zero as a real network revision", async () => {
  const { ledger, account } = fixture();
  const controller = controllerFor(ledger, 0);
  render(
    <BalanceCalibration
      controller={controller}
      account={account}
      date="2026-11-06"
      onClose={vi.fn()}
      onFindRecords={vi.fn()}
    />,
  );
  enterPreview();
  fireEvent.click(screen.getByRole("button", { name: "确认保存新基准" }));
  await waitFor(() => expect(controller.commit).toHaveBeenCalledOnce());
  expect(vi.mocked(controller.commit).mock.calls[0][1]).toEqual({
    mode: "personal",
    expectedRevision: 0,
    expectedCloud: {
      id: "cloud-test",
      server: "https://server.example",
      userId: "user-a",
    },
  });
});
