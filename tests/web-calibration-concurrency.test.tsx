// @vitest-environment jsdom
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
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { CloudController } from "../apps/web/src/hooks/cloud-controller";
import { AppPages } from "../apps/web/src/components/AppPages";

vi.mock("../apps/web/src/platform/browser/runtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../apps/web/src/platform/browser/runtime")
  >()),
  localNow: () => "2026-11-07 12:00:00",
}));
const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));
afterEach(cleanup);

const account: AssetAccount = {
  id: "bank",
  name: "工资卡",
  kind: "asset",
  type: "银行卡",
  currency: "CNY",
  openingBalance: 100000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
};
const bill: BillRecord = {
  id: "later",
  date: "2026-11-06 12:00:00",
  merchant: "午餐",
  description: "",
  amount: 10000,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "手动记账",
  account: "工资卡",
  accountId: "bank",
  orderId: "",
  status: "confirmed",
  sourceStatus: "成功",
  fileName: "",
  raw: {},
  linkedSources: [],
};
const mode = "book:online" as const;
const cloud = {
  id: "remote-book",
  userId: "user-1",
  server: "https://ledger.example",
  role: "owner" as const,
};
const sync: CloudController = {
  user: null,
  books: [],
  isBusy: false,
  message: "",
  error: "",
  preview: null,
  isLinked: false,
  authenticate: async () => {},
  logout: async () => {},
  upload: async () => {},
  sync: async () => {},
  inspect: async () => {},
  restore: async () => {},
  dismissPreview: vi.fn(),
  disconnect: async () => {},
};
const props = {
  sync,
  page: "assets" as const,
  month: "2026-11",
  recordMonth: "",
  onRecordMonth: vi.fn(),
  filter: { source: "" as const, category: "" as const },
  onFilter: vi.fn(),
  onMonth: vi.fn(),
  onNavigate: vi.fn(),
  onSelect: vi.fn(),
  onPreview: vi.fn(),
  onCategory: vi.fn(),
  onUnassigned: vi.fn(),
  onImport: vi.fn(),
  onAdd: vi.fn(),
};
function controller(
  ledger: Ledger,
  options?: { revision?: number; binding?: typeof cloud },
): LedgerController {
  const online = Boolean(options);
  return {
    books: online
      ? [
          ...DEFAULT_BOOKS,
          { id: mode, name: "联网账本", cloud: options?.binding ?? cloud },
        ]
      : DEFAULT_BOOKS,
    ledger,
    personalLedger: ledger,
    mode: online ? mode : "personal",
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
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
    ...(online
      ? {
          network: {
            isConnected: true,
            isOnline: true,
            revision: options?.revision ?? 17,
            error: "",
            refresh: vi.fn(),
          },
        }
      : {}),
  };
}
function openCalibration(): void {
  fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
  fireEvent.click(screen.getByRole("button", { name: "核对实际余额" }));
}
function enterAndPreview(value = "900"): void {
  fireEvent.change(screen.getByRole("textbox", { name: "实际余额" }), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
}
function confirm(): void {
  fireEvent.click(screen.getByRole("button", { name: "确认校准" }));
}

describe("web balance calibration confirmation", () => {
  it("does not describe an existing baseline as missing while the amount is empty or invalid", () => {
    const local = controller({ ...EMPTY_LEDGER, accounts: [account] });
    render(<AppPages {...props} controller={local} />);
    openCalibration();
    const dialog = within(screen.getByRole("dialog"));
    const baseline = dialog.getByText("账面余额").parentElement;
    expect(baseline?.textContent).toBe("账面余额—");
    fireEvent.change(dialog.getByRole("textbox", { name: "实际余额" }), {
      target: { value: "无效" },
    });
    expect(baseline?.textContent).toBe("账面余额—");
    fireEvent.change(dialog.getByRole("textbox", { name: "实际余额" }), {
      target: { value: "900" },
    });
    expect(baseline?.textContent).toBe("账面余额¥1,000.00");
  });

  it("only reports a missing baseline after an actual balance can be projected", () => {
    const futureAccount = { ...account, balanceAt: "2099-01-01 00:00:00" };
    const local = controller({ ...EMPTY_LEDGER, accounts: [futureAccount] });
    render(<AppPages {...props} controller={local} />);
    openCalibration();
    const dialog = within(screen.getByRole("dialog"));
    const baseline = dialog.getByText("账面余额").parentElement;
    expect(baseline?.textContent).toBe("账面余额—");
    fireEvent.change(dialog.getByRole("textbox", { name: "实际余额" }), {
      target: { value: "900" },
    });
    expect(baseline?.textContent).toBe("账面余额尚无基准");
  });

  it("requires an entered amount, previews it, and only then saves a local calibration", async () => {
    const local = controller({ ...EMPTY_LEDGER, accounts: [account] });
    render(<AppPages {...props} controller={local} />);
    openCalibration();
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("");
    enterAndPreview();
    expect(local.commit).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByText(/-¥100\.00/),
    ).toBeTruthy();
    confirm();
    await waitFor(() => expect(local.commit).toHaveBeenCalledOnce());
    const call = vi.mocked(local.commit).mock.calls[0];
    expect(call).toHaveLength(1);
    expect(call[0].accounts[0].openingBalance).toBe(90000);
    expect(call[0].accounts[0].checkpoints).toHaveLength(2);
    expect(call[0].accounts[0].checkpoints[0].balance).toBe(100000);
    expect(call[0].accounts[0].checkpoints[1].balance).toBe(90000);
  });
  it("requires another review if an added bill changes the preview, keeping the entered amount", async () => {
    const first = controller({ ...EMPTY_LEDGER, accounts: [account] });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    const current = controller({
      ...EMPTY_LEDGER,
      accounts: [account],
      records: [bill],
    });
    rerender(<AppPages {...props} controller={current} />);
    confirm();
    expect(current.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/变化|变更|重新核对/);
    fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("900");
    fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
    confirm();
    await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
    expect(vi.mocked(current.commit).mock.calls[0][0].records).toEqual([bill]);
  });
  it("keeps a failed save draft and clears the old error when it is reviewed again", async () => {
    const local = controller({ ...EMPTY_LEDGER, accounts: [account] });
    vi.mocked(local.commit).mockRejectedValueOnce(
      new Error("服务器暂时不可用"),
    );
    render(<AppPages {...props} controller={local} />);
    openCalibration();
    enterAndPreview();
    confirm();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/服务器暂时不可用/),
    );
    fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("900");
    fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
    expect(screen.queryByRole("alert")).toBeNull();
    confirm();
    await waitFor(() => expect(local.commit).toHaveBeenCalledTimes(2));
  });
  it("rejects a new network revision after preview, then uses the newly reviewed revision", async () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [account] };
    const first = controller(ledger, { revision: 17 });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    const current = controller(ledger, { revision: 18 });
    rerender(<AppPages {...props} controller={current} />);
    confirm();
    expect(current.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/变化|变更|重新核对/);
    fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("900");
    fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
    confirm();
    await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
    expect(vi.mocked(current.commit).mock.calls[0][1]).toEqual({
      mode,
      expectedRevision: 18,
      expectedCloud: {
        id: cloud.id,
        userId: cloud.userId,
        server: cloud.server,
      },
    });
  });
  it("accepts a same-revision refresh and submits the exact preview guard", async () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [account] };
    const first = controller(ledger, { revision: 17 });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    const refreshed = controller(
      { ...ledger, accounts: [{ ...account, aliases: [] }] },
      { revision: 17 },
    );
    rerender(<AppPages {...props} controller={refreshed} />);
    confirm();
    await waitFor(() => expect(refreshed.commit).toHaveBeenCalledOnce());
    expect(vi.mocked(refreshed.commit).mock.calls[0][1]).toEqual({
      mode,
      expectedRevision: 17,
      expectedCloud: {
        id: cloud.id,
        userId: cloud.userId,
        server: cloud.server,
      },
    });
  });
  it("does not preview or save without a network revision", () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [account] };
    const first = controller(ledger, { revision: 17 });
    if (!first.network) throw new Error("联网账本状态不存在");
    first.network.revision = undefined;
    render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    expect(first.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/版本|身份/);
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("900");
  });
  it.each(["id", "userId", "server"] as const)(
    "rejects a changed cloud %s at the same revision",
    (field) => {
      const ledger = { ...EMPTY_LEDGER, accounts: [account] };
      const first = controller(ledger, { revision: 17 });
      const { rerender } = render(<AppPages {...props} controller={first} />);
      openCalibration();
      enterAndPreview();
      const current = controller(ledger, {
        revision: 17,
        binding: { ...cloud, [field]: `new-${field}` },
      });
      rerender(<AppPages {...props} controller={current} />);
      confirm();
      expect(current.commit).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toMatch(/账本|变化|变更/);
      fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
      expect(
        (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
          .value,
      ).toBe("900");
    },
  );
  it("rechecks an account changed after preview while preserving the entered amount", async () => {
    const first = controller({ ...EMPTY_LEDGER, accounts: [account] });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    const current = controller({
      ...EMPTY_LEDGER,
      accounts: [{ ...account, aliases: ["远端更改"] }],
    });
    rerender(<AppPages {...props} controller={current} />);
    confirm();
    expect(current.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/账户|变化|变更/);
    fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
    expect(
      (screen.getByRole("textbox", { name: "实际余额" }) as HTMLInputElement)
        .value,
    ).toBe("900");
    fireEvent.click(screen.getByRole("button", { name: "查看校准差额" }));
    confirm();
    await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
    expect(
      vi.mocked(current.commit).mock.calls[0][0].accounts[0].aliases,
    ).toEqual(["远端更改"]);
  });
  it("requires a new review even if the revision later returns to the preview value", () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [account] };
    const first = controller(ledger, { revision: 17 });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    openCalibration();
    enterAndPreview();
    rerender(
      <AppPages {...props} controller={controller(ledger, { revision: 18 })} />,
    );
    const restored = controller(ledger, { revision: 17 });
    rerender(<AppPages {...props} controller={restored} />);
    confirm();
    expect(restored.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/变化|变更|重新核对/);
  });
});

describe("web asset editor book identity", () => {
  it("preserves an unrelated newly added bill while editing the account", async () => {
    const first = controller(
      { ...EMPTY_LEDGER, accounts: [account] },
      { revision: 17 },
    );
    const { rerender } = render(<AppPages {...props} controller={first} />);
    fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "我的草稿" },
    });
    const current = controller(
      { ...EMPTY_LEDGER, accounts: [account], records: [bill] },
      { revision: 18 },
    );
    rerender(<AppPages {...props} controller={current} />);
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
    const [next, guard] = vi.mocked(current.commit).mock.calls[0];
    expect(next.records).toEqual([bill]);
    expect(next.accounts[0].name).toBe("我的草稿");
    expect(guard).toEqual({
      mode,
      expectedRevision: 18,
      expectedCloud: {
        id: cloud.id,
        userId: cloud.userId,
        server: cloud.server,
      },
    });
  });
  it.each(["编辑", "新建"] as const)(
    "rejects a changed cloud binding while %s, preserving the draft",
    (action) => {
      const ledger = { ...EMPTY_LEDGER, accounts: [account] };
      const first = controller(ledger, { revision: 17 });
      const { rerender } = render(<AppPages {...props} controller={first} />);
      if (action === "编辑") {
        fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
        fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
      } else {
        fireEvent.click(screen.getByRole("button", { name: "添加账户" }));
        fireEvent.change(
          screen.getByRole("textbox", { name: "基准余额（CNY）" }),
          { target: { value: "10" } },
        );
      }
      fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
        target: { value: "我的草稿" },
      });
      const current = controller(ledger, {
        revision: 17,
        binding: { ...cloud, id: "other-book" },
      });
      rerender(<AppPages {...props} controller={current} />);
      const form = screen
        .getByRole("button", { name: "保存账户" })
        .closest("form");
      if (!form) throw new Error("账户表单不存在");
      fireEvent.submit(form);
      expect(current.commit).not.toHaveBeenCalled();
      expect(screen.getByRole("alert").textContent).toMatch(/账本|切换|变化/);
      expect(
        (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
          .value,
      ).toBe("我的草稿");
    },
  );
  it("keeps an editor blocked if its cloud binding changes and later returns", () => {
    const ledger = { ...EMPTY_LEDGER, accounts: [account] };
    const first = controller(ledger, { revision: 17 });
    const { rerender } = render(<AppPages {...props} controller={first} />);
    fireEvent.click(screen.getByRole("button", { name: /工资卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "我的草稿" },
    });
    rerender(
      <AppPages
        {...props}
        controller={controller(ledger, {
          revision: 17,
          binding: { ...cloud, id: "other-book" },
        })}
      />,
    );
    const restored = controller(ledger, { revision: 17 });
    rerender(<AppPages {...props} controller={restored} />);
    const form = screen
      .getByRole("button", { name: "保存账户" })
      .closest("form");
    if (!form) throw new Error("账户表单不存在");
    fireEvent.submit(form);
    expect(restored.commit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/账本|切换|变化/);
    expect(
      (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
        .value,
    ).toBe("我的草稿");
  });
});
