// @vitest-environment jsdom
import { useLayoutEffect, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import type { BillRecord, Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { AppShell } from "../../apps/mobile/src/AppShell";

let activeController: LedgerController;
let activeAccount: {
  isLoading: boolean;
  needsEntry: boolean;
  server: string;
  credentials: { user: { id: string; mustChangePassword: boolean } };
};
let confirmed: BillRecord;
let pending: BillRecord;
const observations = vi.fn();
vi.mock("../../apps/mobile/src/hooks/useLedger", () => ({
  useLedger: () => activeController,
}));
vi.mock("../../apps/mobile/src/hooks/useNetworkController", () => ({
  useNetworkController: (controller: LedgerController) => controller,
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => activeAccount,
}));
vi.mock("../../apps/mobile/src/hooks/useNativeSync", () => ({
  useNativeSync: () => ({}),
}));
vi.mock("../../apps/mobile/src/hooks/useBookMonth", () => ({
  useBookMonth: () => ["2026-11", vi.fn()],
}));
vi.mock("../../apps/mobile/src/hooks/usePlanningNotifications", () => ({
  usePlanningNotifications: () => undefined,
}));
vi.mock("../../apps/mobile/src/hooks/useSystemFontScale", () => ({
  useSystemFontScale: () => 1,
}));
vi.mock("../../apps/mobile/src/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));
vi.mock("../../apps/mobile/src/hooks/useKeyboardVisibility", () => ({
  useKeyboardVisibility: () => false,
}));
vi.mock("../../apps/mobile/src/hooks/useAppTheme", () => ({
  useAppTheme: () => ({ colors: { background: "#fff" } }),
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BackHandler: { addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock(
  "../../apps/mobile/node_modules/react-native-safe-area-context/lib/commonjs/index.js",
  () => ({
    SafeAreaView: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }),
);
vi.mock("react-native-paper", () => ({
  FAB: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
  Banner: () => null,
}));
vi.mock("../../apps/mobile/src/ui/LedgerProvider", () => ({
  LedgerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../../apps/mobile/src/ui/LedgerViewBoundary", () => ({
  LedgerViewBoundary: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../../apps/mobile/src/ui/NavigationLayer", () => ({
  NavigationLayer: ({
    children,
    tool,
  }: {
    children: ReactNode;
    tool: ReactNode;
  }) => (
    <>
      {children}
      {tool}
    </>
  ),
}));
vi.mock("../../apps/mobile/src/ui/RetainedToolPages", () => ({
  RetainedToolPages: () => null,
}));
vi.mock("../../apps/mobile/src/ui/AuxiliaryPages", () => ({
  AuxiliaryPages: () => null,
  auxiliaryPageTitle: () => "工具",
}));
vi.mock("../../apps/mobile/src/ui/AppHeader", () => ({
  AppHeader: ({ bookName }: { bookName?: string }) => (
    <header>{bookName}</header>
  ),
}));
vi.mock("../../apps/mobile/src/ui/AppScenes", () => ({
  AppScenes: ({ onRecord }: { onRecord: (record: BillRecord) => void }) => (
    <>
      <button onClick={() => onRecord(confirmed)}>打开已确认</button>
      <button onClick={() => onRecord(pending)}>打开待确认</button>
    </>
  ),
}));
vi.mock("../../apps/mobile/src/ui/AppNavigation", () => ({
  NAVIGATION_BAR_HEIGHT: 80,
  APP_ROUTES: [
    { key: "overview", header: "待处理" },
    { key: "records", header: "账单" },
    { key: "assets", header: "资产" },
  ],
  AppNavigation: ({
    index,
    onIndexChange,
    renderScene,
  }: {
    index: number;
    onIndexChange: (value: number) => void;
    renderScene: (value: { route: { key: string } }) => ReactNode;
  }) => (
    <>
      <button onClick={() => onIndexChange(1)}>账单页</button>
      {renderScene({ route: { key: index === 1 ? "records" : "overview" } })}
    </>
  ),
}));
vi.mock("../../apps/mobile/src/ui/SystemBars", () => ({
  SystemBars: () => null,
}));
vi.mock("../../apps/mobile/src/ui/LedgerSnackbar", () => ({
  LedgerSnackbar: () => null,
}));
vi.mock("../../apps/mobile/src/ui/LedgerLoading", () => ({
  LedgerLoading: () => null,
}));
vi.mock("../../apps/mobile/src/screens/AccountScreen", () => ({
  AccountScreen: () => <p>账号恢复入口</p>,
}));
vi.mock("../../apps/mobile/src/screens/RecordDetail", () => ({
  RecordDetail: ({
    controller,
    record,
    onEdit,
  }: {
    controller: LedgerController;
    record: BillRecord;
    onEdit: (record: BillRecord) => void;
  }) => {
    useLayoutEffect(() => {
      observations(
        "detail",
        controller.ledger.records[0]?.merchant,
        record.merchant,
      );
    }, [controller, record]);
    return (
      <section role="dialog" aria-label="账单详情">
        <span>{record.merchant}</span>
        <button onClick={() => onEdit(record)}>编辑当前账单</button>
      </section>
    );
  },
}));
vi.mock("../../apps/mobile/src/screens/RecordMetadataEditor", () => ({
  RecordMetadataEditor: ({
    controller,
    record,
  }: {
    controller: LedgerController;
    record: BillRecord;
  }) => {
    useLayoutEffect(() => {
      observations(
        "metadata",
        controller.ledger.records[0]?.merchant,
        record.merchant,
      );
    }, [controller, record]);
    return (
      <section role="dialog" aria-label="元数据">
        <span>{record.merchant}</span>
      </section>
    );
  },
}));
vi.mock("../../apps/mobile/src/screens/EntryEditor", () => ({
  EntryEditor: ({
    ledger,
    onCommit,
  }: {
    ledger: Ledger;
    onCommit: (ledger: Ledger, date: string) => Promise<void>;
  }) => {
    const [value, setValue] = useState("");
    useLayoutEffect(() => {
      observations("editor", ledger.records[0]?.merchant, value);
    }, [ledger, value]);
    return (
      <section role="dialog" aria-label="记账草稿">
        <input
          aria-label="草稿内容"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <button onClick={() => void onCommit(ledger, "2026-11-07")}>
          保存草稿
        </button>
      </section>
    );
  },
}));

function controllerFor(
  ledger: Ledger,
  cloud: { id: string; userId: string; server: string },
): LedgerController {
  return {
    ledger,
    personalLedger: ledger,
    books: [
      { id: "personal", name: "当前账本", cloud: { ...cloud, role: "owner" } },
    ],
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
const baseCloud = {
  id: "cloud-a",
  userId: "user-a",
  server: "https://a.example",
};
beforeEach(() => {
  vi.clearAllMocks();
  const example = createDemoLedger();
  confirmed = {
    ...example.records[0],
    id: "confirmed",
    merchant: "旧账单标记",
    status: "confirmed",
  };
  pending = { ...confirmed, id: "pending", status: "pending" };
  activeController = controllerFor(
    { ...example, records: [confirmed, pending] },
    baseCloud,
  );
  activeAccount = {
    isLoading: false,
    needsEntry: false,
    server: "https://a.example",
    credentials: { user: { id: "user-a", mustChangePassword: false } },
  };
});
afterEach(cleanup);
function switchIdentity(
  field: "user" | "server" | "cloudId" | "cloudUser" | "cloudServer",
): LedgerController {
  const example = createDemoLedger();
  const nextLedger = {
    ...example,
    records: [{ ...confirmed, id: "new-record", merchant: "新账本标记" }],
  };
  const cloud = { ...baseCloud };
  if (field === "user")
    activeAccount = {
      ...activeAccount,
      credentials: { user: { id: "user-b", mustChangePassword: false } },
    };
  if (field === "server")
    activeAccount = { ...activeAccount, server: "https://b.example" };
  if (field === "cloudId") cloud.id = "cloud-b";
  if (field === "cloudUser") cloud.userId = "user-b";
  if (field === "cloudServer") cloud.server = "https://b.example";
  activeController = controllerFor(nextLedger, cloud);
  return activeController;
}
function openModal(kind: "detail" | "metadata" | "editor"): void {
  if (kind === "editor") {
    fireEvent.click(screen.getByRole("button", { name: "账单页" }));
    fireEvent.click(screen.getByRole("button", { name: "记一笔" }));
    fireEvent.change(screen.getByLabelText("草稿内容"), {
      target: { value: "旧身份的草稿" },
    });
    return;
  }
  fireEvent.click(
    screen.getByRole("button", {
      name: kind === "detail" ? "打开已确认" : "打开待确认",
    }),
  );
  if (kind === "metadata")
    fireEvent.click(screen.getByRole("button", { name: "编辑当前账单" }));
}
describe("AppShell identity isolation", () => {
  it.each(["user", "server", "cloudId", "cloudUser", "cloudServer"] as const)(
    "does not expose old modals on the first committed frame after %s changes",
    (field) => {
      for (const kind of ["detail", "metadata", "editor"] as const) {
        const view = render(<AppShell />);
        openModal(kind);
        observations.mockClear();
        const next = switchIdentity(field);
        view.rerender(<AppShell />);
        expect(
          observations.mock.calls.filter((entry) => entry[1] === "新账本标记"),
        ).toEqual([]);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(next.commit).not.toHaveBeenCalled();
        view.unmount();
        const example = createDemoLedger();
        activeController = controllerFor(
          { ...example, records: [confirmed, pending] },
          baseCloud,
        );
        activeAccount = {
          isLoading: false,
          needsEntry: false,
          server: "https://a.example",
          credentials: { user: { id: "user-a", mustChangePassword: false } },
        };
      }
    },
  );
  it("keeps an open draft across an ordinary refresh of the same identity", () => {
    const view = render(<AppShell />);
    openModal("editor");
    activeController = controllerFor({ ...activeController.ledger }, baseCloud);
    view.rerender(<AppShell />);
    expect((screen.getByLabelText("草稿内容") as HTMLInputElement).value).toBe(
      "旧身份的草稿",
    );
    expect(activeController.commit).not.toHaveBeenCalled();
  });
});

it.each(["loading", "ledgerLoading", "temporary"] as const)(
  "does not expose a prior book name during the %s gate",
  (gate) => {
    activeController.books = [
      {
        id: "personal",
        name: "旧账本机密",
        cloud: { ...baseCloud, role: "owner" },
      },
    ];
    if (gate === "loading")
      activeAccount = { ...activeAccount, isLoading: true };
    else if (gate === "ledgerLoading") activeController.isLoading = true;
    else
      activeAccount = {
        ...activeAccount,
        credentials: { user: { id: "user-a", mustChangePassword: true } },
      };
    render(<AppShell />);
    expect(screen.queryByText("旧账本机密")).toBeNull();
  },
);

it("shows the book name once the account and ledger are ready", () => {
  activeController.books = [
    {
      id: "personal",
      name: "当前可用账本",
      cloud: { ...baseCloud, role: "owner" },
    },
  ];
  render(<AppShell />);
  expect(screen.getByText("当前可用账本")).toBeTruthy();
});

it("opens account recovery when no local book is available for this identity", () => {
  activeController = {
    ...activeController,
    isLoading: true,
    network: {
      isConnected: false,
      isOnline: false,
      isIdentityBlocked: true,
      error: "",
      refresh: vi.fn(),
    },
  };
  render(<AppShell />);
  expect(screen.getByText("账号恢复入口")).toBeTruthy();
  expect(screen.queryByText("旧账单标记")).toBeNull();
  expect(screen.queryByText("当前账本")).toBeNull();
});

it("does not carry a draft when the ledger mode changes", () => {
  const view = render(<AppShell />);
  openModal("editor");
  observations.mockClear();
  const example = createDemoLedger();
  activeController = {
    ...controllerFor(
      { ...example, records: [{ ...confirmed, merchant: "新账本标记" }] },
      baseCloud,
    ),
    mode: "demo",
    books: [{ id: "demo", name: "示例账本" }],
  };
  view.rerender(<AppShell />);
  expect(
    observations.mock.calls.filter((entry) => entry[1] === "新账本标记"),
  ).toEqual([]);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(activeController.commit).not.toHaveBeenCalled();
});
