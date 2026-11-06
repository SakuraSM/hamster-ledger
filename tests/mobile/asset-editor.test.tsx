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
import { AccountEditor } from "../../apps/mobile/src/screens/AccountEditor";
vi.mock("react-native-paper", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress: () => void;
  }) => <button onClick={onPress}>{children}</button>,
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
  newEntityId: () => "new-account-id",
}));
vi.mock("../../apps/mobile/src/ui/ChoiceField", () => ({
  ChoiceField: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("../../apps/mobile/src/ui/DateField", () => ({
  DateField: () => <span>余额确认时间</span>,
}));
vi.mock("../../apps/mobile/src/ui/FormSheet", () => ({
  FormSheet: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("../../apps/mobile/src/ui/Screen", () => ({
  ErrorMessage: ({ message }: { message: string }) =>
    message ? <span role="alert">{message}</span> : null,
}));
afterEach(cleanup);
function controllerFor(ledger: Ledger): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    books: [],
    mode: "personal",
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
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
it("requires a deliberate baseline for a new account, including zero", async () => {
  const commit = vi.fn().mockResolvedValue(undefined);
  render(
    <AccountEditor
      controller={{ ...controllerFor(createDemoLedger()), commit }}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "新账户" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() =>
    expect(screen.getByText("请输入账户基准余额，可填写 0。")).toBeTruthy(),
  );
  expect(commit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("基准余额（CNY）"), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() => expect(commit).toHaveBeenCalledOnce());
});

it("keeps the draft and refuses to overwrite an account changed during editing", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "editing",
    name: "原账户",
    aliases: [],
  };
  const initial = controllerFor({ ...example, accounts: [account] });
  const onClose = vi.fn();
  const view = render(
    <AccountEditor account={account} controller={initial} onClose={onClose} />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "我的修改" },
  });
  const changed = { ...account, openingBalance: account.openingBalance + 123 };
  const latest = controllerFor({ ...example, accounts: [changed] });
  view.rerender(
    <AccountEditor account={account} controller={latest} onClose={onClose} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBeTruthy(),
  );
  expect(latest.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect((screen.getByLabelText("账户名称") as HTMLInputElement).value).toBe(
    "我的修改",
  );
});

it("refuses to create when another account claimed its draft ID", async () => {
  const example = createDemoLedger();
  const initial = controllerFor({ ...example, accounts: [] });
  const onClose = vi.fn();
  const view = render(<AccountEditor controller={initial} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "新的现金" },
  });
  fireEvent.change(screen.getByLabelText("基准余额（CNY）"), {
    target: { value: "0" },
  });
  const occupied: AssetAccount = {
    ...example.accounts[0],
    id: "new-account-id",
    name: "其他账户",
    aliases: [],
  };
  const latest = controllerFor({ ...example, accounts: [occupied] });
  view.rerender(<AccountEditor controller={latest} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBeTruthy(),
  );
  expect(latest.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect((screen.getByLabelText("账户名称") as HTMLInputElement).value).toBe(
    "新的现金",
  );
});

it("refuses to save when the same local book ID points to another user or server", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "editing",
    name: "原账户",
    aliases: [],
  };
  const initial = controllerFor({ ...example, accounts: [account] });
  initial.books = [
    {
      id: "personal",
      name: "云账本",
      cloud: {
        id: "cloud-a",
        server: "https://first.example",
        userId: "user-a",
        role: "owner",
      },
    },
  ];
  const onClose = vi.fn();
  const view = render(
    <AccountEditor account={account} controller={initial} onClose={onClose} />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "我的修改" },
  });
  const latest = controllerFor({ ...example, accounts: [account] });
  latest.books = [
    {
      id: "personal",
      name: "云账本",
      cloud: {
        id: "cloud-a",
        server: "https://first.example",
        userId: "user-b",
        role: "owner",
      },
    },
  ];
  view.rerender(
    <AccountEditor account={account} controller={latest} onClose={onClose} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("账本已切换"),
  );
  expect(latest.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect((screen.getByLabelText("账户名称") as HTMLInputElement).value).toBe(
    "我的修改",
  );
});

it("retains newly received unrelated records while saving an unchanged account snapshot", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "editing",
    name: "原账户",
    aliases: [],
  };
  const initial = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  const view = render(
    <AccountEditor account={account} controller={initial} onClose={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "我的修改" },
  });
  const newRecord = {
    ...example.records[0],
    id: "new-record",
    accountId: null,
  };
  const latest = controllerFor({
    ...example,
    records: [newRecord],
    accounts: [account],
  });
  view.rerender(
    <AccountEditor account={account} controller={latest} onClose={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() => expect(latest.commit).toHaveBeenCalledOnce());
  expect(vi.mocked(latest.commit).mock.calls[0][0].records).toContainEqual(
    newRecord,
  );
});

it("sends the cloud identity and revision from the edited ledger snapshot", async () => {
  const example = createDemoLedger();
  const account = {
    ...example.accounts[0],
    id: "editing",
    name: "原账户",
    aliases: [],
  };
  const controller = controllerFor({
    ...example,
    records: [],
    accounts: [account],
  });
  controller.books = [
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
  controller.network = {
    isConnected: true,
    isOnline: true,
    revision: 7,
    error: "",
    refresh: vi.fn(),
  };
  render(
    <AccountEditor
      account={account}
      controller={controller}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "新账户名称" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() => expect(controller.commit).toHaveBeenCalledOnce());
  expect(vi.mocked(controller.commit).mock.calls[0][1]).toEqual({
    mode: "personal",
    expectedRevision: 7,
    expectedCloud: {
      id: "cloud",
      server: "https://server.example",
      userId: "user-a",
    },
  });
});

it("rejects saving when the editor is retargeted to a different account", async () => {
  const example = createDemoLedger();
  const first = {
    ...example.accounts[0],
    id: "first",
    name: "第一个账户",
    aliases: [],
  };
  const second = { ...first, id: "second", name: "第二个账户" };
  const controller = controllerFor({ ...example, accounts: [first, second] });
  const onClose = vi.fn();
  const view = render(
    <AccountEditor account={first} controller={controller} onClose={onClose} />,
  );
  fireEvent.change(screen.getByLabelText("账户名称"), {
    target: { value: "未保存的修改" },
  });
  view.rerender(
    <AccountEditor
      account={second}
      controller={controller}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("账户已切换"),
  );
  expect(controller.commit).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
