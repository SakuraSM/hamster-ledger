// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "./helpers/render";
import {
  EMPTY_LEDGER,
  DEFAULT_BOOKS,
  saveAssetAccount,
  type AssetAccount,
  type Ledger,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import type { CloudController } from "../apps/web/src/hooks/cloud-controller";
import { AppPages } from "../apps/web/src/components/AppPages";
import {
  AccountEditor,
  type AccountSave,
} from "../apps/web/src/components/assets/AccountEditor";

const { testClient } = vi.hoisted(() => ({ testClient: { request: vi.fn() } }));
vi.mock("../apps/web/src/hooks/useNetworkController", () => ({
  useNetworkClient: () => testClient,
}));

afterEach(cleanup);
const original: AssetAccount = {
  id: "card",
  name: "信用卡",
  kind: "liability",
  type: "信用卡",
  currency: "CNY",
  openingBalance: 50000,
  balanceAt: "2026-01-01 00:00:00",
  aliases: ["原别名"],
  isArchived: false,
  creditLimit: 100000,
  checkpoints: [],
};

function controllerFor(
  ledger: Ledger,
  mode: LedgerController["mode"],
): LedgerController {
  return {
    books: DEFAULT_BOOKS,
    ledger,
    personalLedger: ledger,
    mode,
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: async () => "personal",
    updateBooks: async () => {},
    switchMode: () => {},
    commit: vi.fn(),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: async () => {},
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
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
const pageProps = {
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

const onlineMode = "book:online" as const;
const onlineCloud = {
  id: "remote-book",
  userId: "user-1",
  server: "https://ledger.example",
  role: "owner" as const,
};
function onlineController(ledger: Ledger): LedgerController {
  return {
    ...controllerFor(ledger, onlineMode),
    books: [
      ...DEFAULT_BOOKS,
      { id: onlineMode, name: "联网账本", cloud: onlineCloud },
    ],
    network: {
      isConnected: true,
      isOnline: true,
      revision: 17,
      error: "",
      refresh: vi.fn(),
    },
  };
}
const expectedGuard = {
  mode: onlineMode,
  expectedRevision: 17,
  expectedCloud: {
    id: onlineCloud.id,
    userId: onlineCloud.userId,
    server: onlineCloud.server,
  },
};

describe("asset account editor conflicts", () => {
  it("preserves a draft and rejects a concurrent account update", async () => {
    let ledger = { ...EMPTY_LEDGER, accounts: [original] };
    const onClose = vi.fn();
    const save = vi.fn(async (input: AccountSave) => {
      ledger = saveAssetAccount({
        ledger,
        ...input,
        now: "2026-11-07 12:00:00",
        checkpointId: "checkpoint",
      });
    });
    const { rerender } = render(
      <AccountEditor account={original} onSave={save} onClose={onClose} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "我的草稿" },
    });
    const remote = { ...original, aliases: ["远端更新"], creditLimit: 200000 };
    ledger = { ...ledger, accounts: [remote] };
    rerender(
      <AccountEditor account={remote} onSave={save} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /更新|变更|变化|冲突/,
      ),
    );
    expect(save.mock.calls[0][0].expectedAccount).toEqual(original);
    expect(
      (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
        .value,
    ).toBe("我的草稿");
    expect(ledger.accounts[0]).toEqual(remote);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("captures arrays as a separate snapshot when the source object changes", async () => {
    const archiveHistory = [{ at: "2026-01-02 00:00:00", isArchived: false }];
    const source: AssetAccount = {
      ...original,
      archiveHistory,
      aliases: ["旧别名"],
      checkpoints: [
        {
          id: "one",
          balance: 50000,
          at: "2026-01-01 00:00:00",
          note: "旧备注",
          recordedAt: "2026-01-01 00:00:00",
        },
      ],
    };
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AccountEditor account={source} onSave={save} onClose={vi.fn()} />);
    source.aliases[0] = "新别名";
    source.checkpoints[0].note = "新备注";
    archiveHistory[0].at = "2026-01-03 00:00:00";
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].expectedAccount.aliases).toEqual(["旧别名"]);
    expect(save.mock.calls[0][0].expectedAccount.checkpoints[0].note).toBe(
      "旧备注",
    );
    expect(save.mock.calls[0][0].expectedAccount.archiveHistory[0].at).toBe(
      "2026-01-02 00:00:00",
    );
  });

  it("blocks a reused editor when its account identity changes", () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AccountEditor account={original} onSave={save} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "旧账户草稿" },
    });
    rerender(
      <AccountEditor
        account={{ ...original, id: "other", name: "另一账户" }}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/账户.*切换/);
    expect(
      (screen.getByRole("button", { name: "保存账户" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
        .value,
    ).toBe("旧账户草稿");
    const form = screen
      .getByRole("button", { name: "保存账户" })
      .closest("form");
    if (!form) throw new Error("账户表单不存在");
    fireEvent.submit(form);
    expect(save).not.toHaveBeenCalled();
  });

  it("marks a newly created account as expected absent", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AccountEditor onSave={save} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "新账户" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "基准余额（CNY）" }), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].expectedAccount).toBeNull();
  });
  it("rejects a refreshed account through the actual asset page save path", async () => {
    const first = controllerFor(
      { ...EMPTY_LEDGER, accounts: [original] },
      "personal",
    );
    const { rerender } = render(<AppPages {...pageProps} controller={first} />);
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "未保存草稿" },
    });
    const remote = { ...original, aliases: ["远端别名"], creditLimit: 200000 };
    const current = controllerFor(
      { ...EMPTY_LEDGER, accounts: [remote] },
      "personal",
    );
    rerender(<AppPages {...pageProps} controller={current} />);
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /更新|变更|变化|冲突/,
      ),
    );
    expect(current.commit).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
        .value,
    ).toBe("未保存草稿");
  });

  it("discards the old account editor when switching books with the same account ID", () => {
    const first = controllerFor(
      { ...EMPTY_LEDGER, accounts: [original] },
      "personal",
    );
    const { rerender } = render(<AppPages {...pageProps} controller={first} />);
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    expect(screen.getByRole("dialog", { name: "编辑资产账户" })).toBeTruthy();
    const second = controllerFor(
      { ...EMPTY_LEDGER, accounts: [{ ...original, name: "示例信用卡" }] },
      "demo",
    );
    rerender(<AppPages {...pageProps} controller={second} />);
    expect(screen.queryByRole("dialog", { name: "编辑资产账户" })).toBeNull();
    expect(screen.getByRole("button", { name: /示例信用卡/ })).toBeTruthy();
    expect(second.commit).not.toHaveBeenCalled();
  });
  it("still saves an unchanged baseline through the asset page", async () => {
    const current = controllerFor(
      { ...EMPTY_LEDGER, accounts: [original] },
      "personal",
    );
    render(<AppPages {...pageProps} controller={current} />);
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "信用卡新名字" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
    expect(
      vi.mocked(current.commit).mock.calls[0][0].accounts[0],
    ).toMatchObject({ id: "card", name: "信用卡新名字", aliases: ["原别名"] });
  });
  it.each(["编辑", "归档", "转账"] as const)(
    "passes the network snapshot guard when saving %s",
    async (action) => {
      const bank: AssetAccount = {
        ...original,
        id: "bank",
        name: "付款卡",
        kind: "asset",
        type: "银行卡",
        creditLimit: undefined,
        aliases: [],
      };
      const current = onlineController({
        ...EMPTY_LEDGER,
        accounts: [original, bank],
      });
      render(<AppPages {...pageProps} controller={current} />);
      if (action === "转账") {
        fireEvent.click(screen.getByRole("button", { name: "账户间转账" }));
        fireEvent.change(
          screen.getByRole("textbox", { name: "转出金额（CNY）" }),
          { target: { value: "10" } },
        );
        fireEvent.click(screen.getByRole("combobox", { name: "转出账户" }));
        fireEvent.click(screen.getByRole("option", { name: /付款卡/ }));
        fireEvent.click(screen.getByRole("combobox", { name: "转入账户" }));
        fireEvent.click(screen.getByRole("option", { name: /信用卡/ }));
        fireEvent.click(screen.getByRole("button", { name: "确认转账" }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
        if (action === "编辑") {
          fireEvent.click(
            screen.getAllByRole("button", { name: "编辑账户" })[0],
          );
          fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
            target: { value: "信用卡更新" },
          });
          fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
        } else {
          fireEvent.click(screen.getByRole("button", { name: "归档账户" }));
          fireEvent.click(screen.getByRole("button", { name: "确认归档" }));
        }
      }
      await waitFor(() => expect(current.commit).toHaveBeenCalledOnce());
      expect(vi.mocked(current.commit).mock.calls[0][1]).toEqual(expectedGuard);
    },
  );

  it("retains the account draft if a newer network revision rejects the save", async () => {
    const current = onlineController({ ...EMPTY_LEDGER, accounts: [original] });
    const latestRevision = 18;
    current.commit = vi.fn(async (_next, options) => {
      if (
        typeof options !== "object" ||
        options.expectedRevision !== latestRevision
      )
        throw new Error("账本已更新，请重新打开后重试；当前修改尚未保存。");
    });
    render(<AppPages {...pageProps} controller={current} />);
    fireEvent.click(screen.getByRole("button", { name: /信用卡/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑账户" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "账户名称" }), {
      target: { value: "待保存草稿" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存账户" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("账本已更新"),
    );
    expect(vi.mocked(current.commit).mock.calls[0][1]).toEqual(expectedGuard);
    expect(
      (screen.getByRole("textbox", { name: "账户名称" }) as HTMLInputElement)
        .value,
    ).toBe("待保存草稿");
  });
});
