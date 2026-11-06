// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "./helpers/render";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  migrateLedger,
  type BillRecord,
  type Ledger,
  type LedgerMode,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { App } from "../apps/web/src/App";

const runtime = vi.hoisted(() => ({
  controller: null as LedgerController | null,
  user: { id: "user-a" } as { id: string } | null,
  frames: [] as string[],
  onPreview: null as ((record: BillRecord) => void) | null,
  onSelect: null as ((record: BillRecord) => void) | null,
  onFilter: null as ((value: { source: ""; category: string }) => void) | null,
  onAdd: null as ((date?: string) => void) | null,
  client: { request: vi.fn() },
  logout: vi.fn(),
}));
vi.mock("../apps/web/src/auth/auth-context", () => ({
  useAuth: () => ({
    user: runtime.user,
    isLocalOnly: false,
    error: "",
    logout: runtime.logout,
  }),
}));
vi.mock("../apps/web/src/hooks/useLedger", () => ({
  useLedger: () => runtime.controller,
}));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkController: () => runtime.controller,
  useNetworkClient: () => runtime.client,
}));
vi.mock("../apps/web/src/hooks/useCloudSync", () => ({
  useCloudSync: () => ({}),
}));
vi.mock("../apps/web/src/hooks/usePreferences", () => ({
  usePreferences: () => {},
}));
vi.mock("../apps/web/src/components/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../apps/web/src/components/AppHeader", () => ({
  AppHeader: ({ onAdd }: { onAdd: () => void }) => (
    <button onClick={onAdd}>打开新账单</button>
  ),
}));
vi.mock("../apps/web/src/ui/LedgerNotice", () => ({
  LedgerNotice: () => null,
}));
vi.mock("../apps/web/src/components/ai/RecordAttachments", () => ({
  RecordAttachments: () => null,
}));
vi.mock("../apps/web/src/components/AppPages", () => ({
  AppPages: ({
    controller,
    onSelect,
    onPreview,
    filter,
    onFilter,
    onAdd,
  }: {
    controller: LedgerController;
    onSelect: (record: BillRecord) => void;
    onPreview: (record: BillRecord) => void;
    filter: { source: string; category: string };
    onFilter: (value: { source: ""; category: string }) => void;
    onAdd: (date?: string) => void;
  }) => {
    runtime.onPreview = onPreview;
    runtime.onSelect = onSelect;
    runtime.onFilter = onFilter;
    runtime.onAdd = onAdd;
    const record = controller.ledger.records[0];
    return record ? (
      <>
        <button onClick={() => onSelect(record)}>查看真实账单</button>
        <button onClick={() => onPreview(record)}>查看原始字段</button>
        <button
          onClick={() => onFilter({ source: "", category: "旧私有分类" })}
        >
          选择筛选
        </button>
        <p>{filter.category}</p>
      </>
    ) : null;
  },
}));
vi.mock("../apps/web/src/components/RecordDetail", () => ({
  RecordDetail: ({
    record,
    onEdit,
  }: {
    record: BillRecord;
    onEdit: () => void;
  }) => (
    <section role="dialog" aria-label="账单详情">
      <p>{record.merchant}</p>
      <button onClick={onEdit}>编辑账单</button>
    </section>
  ),
}));
function Probe({ frame }: { frame: string }): React.JSX.Element {
  useLayoutEffect(() => {
    const fields = Array.from(document.querySelectorAll("input, textarea"))
      .map((field) =>
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
          ? field.value
          : "",
      )
      .join(" ");
    runtime.frames.push(`${document.body.textContent ?? ""} ${fields}`);
  }, [frame]);
  return <App />;
}
const mode = "book:one" as const;
const cloud = {
  id: "cloud-a",
  userId: "user-a",
  server: "https://a",
  role: "owner" as const,
};
function ledger(name = "旧账单明文"): Ledger {
  return migrateLedger({
    ...EMPTY_LEDGER,
    records: [
      {
        id: "same-record",
        date: "2026-10-05 12:00:00",
        merchant: name,
        description: "",
        amount: 20000,
        currency: "CNY",
        kind: "支出",
        category: "餐饮",
        source: "手动记账",
        account: "",
        accountId: null,
        orderId: "",
        status: "confirmed",
        sourceStatus: "成功",
        fileName: "",
        raw: { 商户原文: "旧原始字段" },
        linkedSources: [],
      },
    ],
  });
}
function controller(
  input: {
    bookMode?: LedgerMode;
    binding?: typeof cloud;
    bookLedger?: Ledger;
    revision?: number;
  } = {},
): LedgerController {
  const bookMode = input.bookMode ?? mode,
    binding = input.binding ?? cloud,
    bookLedger = input.bookLedger ?? ledger();
  return {
    books: [
      ...DEFAULT_BOOKS,
      { id: bookMode, name: "联网账本", cloud: binding },
    ],
    ledger: bookLedger,
    personalLedger: bookLedger,
    mode: bookMode,
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn().mockResolvedValue(undefined),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
    network: {
      isConnected: true,
      isOnline: true,
      revision: input.revision ?? 1,
      error: "",
      refresh: vi.fn(),
    },
  };
}
function switchIdentity(kind: string): void {
  if (kind === "mode")
    runtime.controller = controller({
      bookMode: "book:two",
      bookLedger: ledger("新账单"),
    });
  if (kind === "login") {
    runtime.user = { id: "user-b" };
    runtime.controller = controller({ bookLedger: ledger("新账单") });
  }
  if (kind === "logout") {
    runtime.user = null;
    runtime.controller = controller({ bookLedger: ledger("新账单") });
  }
  if (kind === "cloud id")
    runtime.controller = controller({
      binding: { ...cloud, id: "cloud-b" },
      bookLedger: ledger("新账单"),
    });
  if (kind === "cloud user")
    runtime.controller = controller({
      binding: { ...cloud, userId: "other-owner" },
      bookLedger: ledger("新账单"),
    });
  if (kind === "cloud server")
    runtime.controller = controller({
      binding: { ...cloud, server: "https://b" },
      bookLedger: ledger("新账单"),
    });
}
beforeEach(() => {
  runtime.logout.mockReset().mockResolvedValue(undefined);
  runtime.controller = controller();
  runtime.user = { id: "user-a" };
  runtime.frames = [];
  runtime.onPreview = null;
  runtime.onSelect = null;
  runtime.onFilter = null;
  runtime.onAdd = null;
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);
it("offers account recovery without rendering a blocked ledger", () => {
  runtime.controller = {
    ...controller(),
    isLoading: true,
    error: "没有可用的本地账本，请登录对应账号后重试。",
    network: {
      isConnected: false,
      isOnline: false,
      isIdentityBlocked: true,
      error: "",
      refresh: vi.fn(),
    },
  };
  render(<App />);
  expect(screen.queryByText("旧账单明文")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "退出当前账号并切换" }));
  expect(runtime.logout).toHaveBeenCalledOnce();
});
it("shows a failed logout when account recovery cannot proceed", async () => {
  runtime.logout.mockRejectedValue(new Error("暂时无法连接账号服务"));
  runtime.controller = {
    ...controller(),
    isLoading: true,
    network: {
      isConnected: false,
      isOnline: false,
      isIdentityBlocked: true,
      error: "",
      refresh: vi.fn(),
    },
  };
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "退出当前账号并切换" }));
  expect(await screen.findByText("暂时无法连接账号服务")).toBeTruthy();
});

describe("App modal identity", () => {
  it("preserves the add-entry deep link while the initial ledger is loading", () => {
    window.history.replaceState({}, "", "/?action=add");
    const loading = controller({ bookMode: "demo" });
    loading.isLoading = true;
    runtime.controller = loading;
    const view = render(<Probe frame="loading" />);
    runtime.controller = controller();
    view.rerender(<Probe frame="loaded" />);
    expect(screen.getByRole("dialog", { name: "记一笔" })).toBeTruthy();
  });
  it.each([
    "mode",
    "login",
    "logout",
    "cloud id",
    "cloud user",
    "cloud server",
  ])("hides old detail in the first frame when %s changes", (kind) => {
    const view = render(<Probe frame="before" />);
    fireEvent.click(screen.getByRole("button", { name: "查看真实账单" }));
    expect(
      screen.getByRole("dialog", { name: "账单详情" }).textContent,
    ).toContain("旧账单明文");
    switchIdentity(kind);
    view.rerender(<Probe frame="after" />);
    expect(screen.queryByRole("dialog", { name: "账单详情" })).toBeNull();
    expect(runtime.frames.at(-1)).not.toContain("旧账单明文");
    expect(runtime.controller?.commit).not.toHaveBeenCalled();
  });
  it.each([
    "mode",
    "login",
    "logout",
    "cloud id",
    "cloud user",
    "cloud server",
  ])(
    "clears an open editor without exposing its draft when %s changes",
    (kind) => {
      const view = render(<Probe frame="before" />);
      fireEvent.click(screen.getByRole("button", { name: "查看真实账单" }));
      fireEvent.click(screen.getByRole("button", { name: "编辑账单" }));
      const dialog = within(screen.getByRole("dialog", { name: "编辑账单" }));
      fireEvent.change(dialog.getByRole("textbox", { name: /商户/ }), {
        target: { value: "旧身份私人草稿" },
      });
      switchIdentity(kind);
      view.rerender(<Probe frame="after" />);
      expect(screen.queryByRole("dialog", { name: "编辑账单" })).toBeNull();
      expect(runtime.frames.at(-1)).not.toContain("旧身份私人草稿");
      expect(runtime.controller?.commit).not.toHaveBeenCalled();
    },
  );
  it.each([
    "mode",
    "login",
    "logout",
    "cloud id",
    "cloud user",
    "cloud server",
  ])("clears raw import preview when %s changes", (kind) => {
    const view = render(<Probe frame="before" />);
    fireEvent.click(screen.getByRole("button", { name: "查看原始字段" }));
    expect(screen.getByText("旧原始字段")).toBeTruthy();
    switchIdentity(kind);
    view.rerender(<Probe frame="after" />);
    expect(screen.queryByText("旧原始字段")).toBeNull();
    expect(runtime.frames.at(-1)).not.toContain("旧原始字段");
  });
  it("does not resurrect old previews after switching away and back, including stale callbacks", () => {
    const view = render(<Probe frame="a" />);
    const oldPreview = runtime.onPreview!;
    const oldRecord = runtime.controller!.ledger.records[0];
    fireEvent.click(screen.getByRole("button", { name: "查看原始字段" }));
    switchIdentity("cloud id");
    view.rerender(<Probe frame="b" />);
    act(() => oldPreview(oldRecord));
    runtime.controller = controller();
    view.rerender(<Probe frame="a-again" />);
    act(() => oldPreview(oldRecord));
    expect(screen.queryByText("旧原始字段")).toBeNull();
  });
  it("rejects all old scope callbacks after switching away and back", () => {
    const view = render(<Probe frame="before" />);
    const oldRecord = runtime.controller!.ledger.records[0];
    const oldSelect = runtime.onSelect!;
    const oldPreview = runtime.onPreview!;
    const oldFilter = runtime.onFilter!;
    const oldAdd = runtime.onAdd!;
    switchIdentity("cloud id");
    view.rerender(<Probe frame="other" />);
    runtime.controller = controller();
    view.rerender(<Probe frame="returned" />);
    act(() => {
      oldSelect(oldRecord);
      oldPreview(oldRecord);
      oldFilter({ source: "", category: "旧私有分类" });
      oldAdd("2026-10-05");
    });
    expect(screen.queryByRole("dialog", { name: "账单详情" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "记一笔" })).toBeNull();
    expect(screen.queryByText("旧原始字段")).toBeNull();
    expect(screen.queryByText("旧私有分类")).toBeNull();
  });
  it("keeps a detail open when only the revision changes", () => {
    const view = render(<Probe frame="before" />);
    fireEvent.click(screen.getByRole("button", { name: "查看真实账单" }));
    runtime.controller = controller({
      bookLedger: ledger("远端新内容"),
      revision: 2,
    });
    view.rerender(<Probe frame="after" />);
    expect(screen.getByRole("dialog", { name: "账单详情" })).toBeTruthy();
  });
  it("retains filters on same-identity refresh and clears them when the book identity changes", () => {
    const view = render(<Probe frame="before" />);
    fireEvent.click(screen.getByRole("button", { name: "选择筛选" }));
    expect(screen.getByText("旧私有分类")).toBeTruthy();
    runtime.controller = controller({ revision: 2 });
    view.rerender(<Probe frame="refresh" />);
    expect(screen.getByText("旧私有分类")).toBeTruthy();
    switchIdentity("cloud id");
    view.rerender(<Probe frame="changed" />);
    expect(screen.queryByText("旧私有分类")).toBeNull();
    expect(runtime.frames.at(-1)).not.toContain("旧私有分类");
  });
  it("preserves an editor draft through same-identity refresh and reports a real record conflict", async () => {
    const view = render(<Probe frame="before" />);
    fireEvent.click(screen.getByRole("button", { name: "查看真实账单" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑账单" }));
    const dialog = within(screen.getByRole("dialog", { name: "编辑账单" }));
    fireEvent.change(dialog.getByRole("textbox", { name: /商户/ }), {
      target: { value: "保留的草稿" },
    });
    const changed = ledger("远端新内容");
    runtime.controller = controller({ bookLedger: changed, revision: 2 });
    view.rerender(<Probe frame="after" />);
    expect(
      (dialog.getByRole("textbox", { name: /商户/ }) as HTMLInputElement).value,
    ).toBe("保留的草稿");
    fireEvent.click(dialog.getByRole("button", { name: /保存/ }));
    await waitFor(() =>
      expect(dialog.getByRole("alert").textContent).toMatch(
        /变化|变更|冲突|更新/,
      ),
    );
    expect(runtime.controller.commit).not.toHaveBeenCalled();
  });
});
