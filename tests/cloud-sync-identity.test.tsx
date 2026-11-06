// @vitest-environment jsdom
import { useLayoutEffect } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LEDGER, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
type CreateBookPreparation = NonNullable<
  Parameters<LedgerController["createBook"]>[3]
>;
import { useCloudSync } from "../apps/web/src/hooks/useCloudSync";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { queueLedgerWrite } from "../packages/ledger-react/src/ledger-write-queue";
import { DEFAULT_BOOKS, type LedgerRepository } from "@hamster-ledger/core";

const env = vi.hoisted(() => ({
  userId: "a",
  session: "sa",
  users: { a: { id: "a", username: "a" }, b: { id: "b", username: "b" } },
  sessions: { sa: { id: "sa" }, sb: { id: "sb" } },
  storage: new Map<string, string>(),
  failNewLink: false,
  books: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../apps/web/src/auth/auth-context", () => ({
  useAuth: () => ({
    user: env.userId === "a" ? env.users.a : env.users.b,
    session: env.session === "sa" ? env.sessions.sa : env.sessions.sb,
    isOffline: false,
    error: "",
    authenticate: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock("../apps/web/src/platform/browser/cloud", async (original) => ({
  ...(await original<
    typeof import("../apps/web/src/platform/browser/cloud")
  >()),
  cloud: { books: env.books, load: env.load, save: env.save },
}));
vi.mock("../apps/web/src/platform/browser/vault", () => ({
  protectedStore: {
    getItem: async (key: string) => env.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (env.failNewLink && key.endsWith(":book:new"))
        throw new Error("连接存储失败");
      env.storage.set(key, value);
    },
  },
}));
vi.mock("../apps/web/src/platform/browser/sync-link", () => ({
  linkKey: (user: string, mode: string) => `${user}:${mode}`,
  fingerprint: async (value: unknown) => JSON.stringify(value),
}));
function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const book = {
  id: "remote",
  name: "用户A私密云账本",
  revision: 2,
  updatedAt: "2026-11-01",
  ledger: { ...EMPTY_LEDGER, rules: { 私密: "购物" } },
};
function controller(): LedgerController {
  return {
    books: [{ id: "personal", name: "本机账本" }],
    mode: "personal",
    ledger: EMPTY_LEDGER,
    personalLedger: EMPTY_LEDGER,
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: vi.fn(async () => "book:new" as const),
    updateBooks: vi.fn(async () => {}),
    switchMode: vi.fn(),
    commit: vi.fn(async () => {}),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(async () => {}),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
}
beforeEach(() => {
  env.userId = "a";
  env.session = "sa";
  env.storage.clear();
  env.failNewLink = false;
  vi.clearAllMocks();
  env.storage.set(
    "a:personal",
    JSON.stringify({
      id: "remote",
      revision: 1,
      fingerprint: JSON.stringify({ ledger: EMPTY_LEDGER, name: "本机账本" }),
    }),
  );
  env.books.mockImplementation(async (user: string) => ({
    books: user === "a" ? [book] : [],
  }));
  env.load.mockResolvedValue(book);
  env.save.mockResolvedValue(book);
});
afterEach(cleanup);
function setup(current: LedgerController) {
  const frames: Array<{
    books: number;
    preview: string | null;
    linked: boolean;
    message: string;
  }> = [];
  const hook = renderHook(
    ({
      controller,
      frame,
    }: {
      controller: LedgerController;
      frame: string;
    }) => {
      const sync = useCloudSync(controller);
      useLayoutEffect(() => {
        frames.push({
          books: sync.books.length,
          preview: sync.preview?.name ?? null,
          linked: sync.isLinked,
          message: sync.message,
        });
      }, [frame]);
      return sync;
    },
    { initialProps: { controller: current, frame: "a" } },
  );
  return { hook, frames };
}
async function ready(hook: ReturnType<typeof setup>["hook"]) {
  await waitFor(() => expect(hook.result.current.isLinked).toBe(true));
  await waitFor(() => expect(hook.result.current.books).toHaveLength(1));
}
describe("Web sync identity isolation", () => {
  it.each(["mode", "session", "cloud id", "cloud user", "cloud server"])(
    "clears prior visible state on %s change",
    async (change) => {
      const current = controller();
      if (change.startsWith("cloud"))
        current.books[0].cloud = {
          id: "cloud-a",
          userId: "a",
          server: "https://a",
          role: "owner",
        };
      const { hook, frames } = setup(current);
      await ready(hook);
      const next: LedgerController = {
        ...current,
        books: current.books.map((book) => ({
          ...book,
          cloud: book.cloud ? { ...book.cloud } : undefined,
        })),
      };
      if (change === "mode") {
        next.mode = "book:other";
        next.books = [...next.books, { id: "book:other", name: "另一本" }];
      }
      if (change === "session") env.session = "sb";
      if (change === "cloud id") next.books[0].cloud!.id = "cloud-b";
      if (change === "cloud user") next.books[0].cloud!.userId = "b";
      if (change === "cloud server") next.books[0].cloud!.server = "https://b";
      hook.rerender({ controller: next, frame: change });
      expect(frames.at(-1)).toEqual({
        books: 0,
        preview: null,
        linked: false,
        message: "",
      });
    },
  );
  it("does not write an old download that is still waiting in the real ledger queue", async () => {
    let stored: Ledger = EMPTY_LEDGER;
    const hold = deferred<void>(),
      started = deferred<void>();
    const repository: LedgerRepository = {
      listBooks: async () => DEFAULT_BOOKS,
      saveBooks: async () => {},
      load: async () => stored,
      save: async (_mode, value) => {
        stored = value;
      },
      loadActiveMode: async () => "personal",
      saveActiveMode: async () => {},
    };
    const blocker = queueLedgerWrite({
      repository,
      mode: "personal",
      write: async () => {
        started.resolve();
        await hold.promise;
      },
    });
    await started.promise;
    env.storage.set(
      "a:personal",
      JSON.stringify({
        id: "remote",
        revision: 1,
        fingerprint: JSON.stringify({ ledger: EMPTY_LEDGER, name: "我的账本" }),
      }),
    );
    const hook = renderHook(() => {
      const controller = useLedger({
        repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: () => "id",
      });
      return { controller, sync: useCloudSync(controller) };
    });
    await waitFor(() =>
      expect(hook.result.current.controller.isLoading).toBe(false),
    );
    await waitFor(() => expect(hook.result.current.sync.isLinked).toBe(true));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.sync.sync();
    });
    await waitFor(() =>
      expect(hook.result.current.controller.isSaving).toBe(true),
    );
    env.userId = "b";
    env.session = "sb";
    hook.rerender();
    await act(async () => {
      hold.resolve();
      await blocker;
      await pending.catch(() => {});
    });
    expect(stored.rules).toEqual({});
    expect(hook.result.current.controller.ledger.rules).toEqual({});
  });
  it("restores an authorized snapshot into a new local book and links the new mode", async () => {
    const saved = new Map<string, Ledger>();
    const repository: LedgerRepository = {
      listBooks: async () => DEFAULT_BOOKS,
      saveBooks: async () => {},
      load: async (mode) => saved.get(mode) ?? EMPTY_LEDGER,
      save: async (mode, value) => {
        saved.set(mode, value);
      },
      loadActiveMode: async () => "personal",
      saveActiveMode: async () => {},
    };
    const hook = renderHook(() => {
      const controller = useLedger({
        repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: () => "new",
      });
      return { controller, sync: useCloudSync(controller) };
    });
    await waitFor(() =>
      expect(hook.result.current.controller.isLoading).toBe(false),
    );
    await act(async () => hook.result.current.sync.inspect("remote"));
    await act(async () => hook.result.current.sync.restore());
    expect(hook.result.current.controller.mode).toBe("book:new");
    expect(saved.get("book:new")?.rules).toEqual({ 私密: "购物" });
    expect(JSON.parse(env.storage.get("a:book:new") ?? "null")).toMatchObject({
      id: "remote",
      revision: 2,
    });
    await waitFor(() => expect(hook.result.current.sync.isLinked).toBe(true));
  });
  it("reports when the book was restored but its new sync link could not be written", async () => {
    const saved = new Map<string, Ledger>();
    const repository: LedgerRepository = {
      listBooks: async () => DEFAULT_BOOKS,
      saveBooks: async () => {},
      load: async (mode) => saved.get(mode) ?? EMPTY_LEDGER,
      save: async (mode, value) => {
        saved.set(mode, value);
      },
      loadActiveMode: async () => "personal",
      saveActiveMode: async () => {},
    };
    const hook = renderHook(() => {
      const controller = useLedger({
        repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: () => "new",
      });
      return { controller, sync: useCloudSync(controller) };
    });
    await waitFor(() =>
      expect(hook.result.current.controller.isLoading).toBe(false),
    );
    await act(async () => hook.result.current.sync.inspect("remote"));
    env.failNewLink = true;
    await act(async () => {
      await hook.result.current.sync.restore().catch(() => {});
    });
    expect(saved.get("book:new")?.rules).toEqual({ 私密: "购物" });
    expect(hook.result.current.controller.notice).toMatch(/恢复.*连接.*失败/);
  });
  it("hides old books, preview, link and message in the first frame after a user change", async () => {
    const current = controller(),
      { hook, frames } = setup(current);
    await ready(hook);
    await act(async () => hook.result.current.inspect("remote"));
    await act(async () => hook.result.current.upload());
    expect(hook.result.current.preview?.name).toBe(book.name);
    expect(hook.result.current.message).not.toBe("");
    env.userId = "b";
    env.session = "sb";
    hook.rerender({ controller: current, frame: "b" });
    expect(frames.at(-1)).toEqual({
      books: 0,
      preview: null,
      linked: false,
      message: "",
    });
  });
  it("retains same-identity state on an ordinary ledger refresh", async () => {
    const current = controller(),
      { hook } = setup(current);
    await ready(hook);
    await act(async () => hook.result.current.inspect("remote"));
    hook.rerender({
      controller: { ...current, ledger: { ...EMPTY_LEDGER } },
      frame: "refresh",
    });
    expect(hook.result.current.preview?.name).toBe(book.name);
    expect(hook.result.current.isLinked).toBe(true);
  });
  it("does not publish an upload result or checkpoint after the user changes", async () => {
    const current = controller(),
      hold = deferred<typeof book>(),
      { hook } = setup(current);
    await ready(hook);
    const oldLink = env.storage.get("a:personal");
    env.save.mockReturnValueOnce(hold.promise);
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.upload();
    });
    await waitFor(() => expect(env.save).toHaveBeenCalledOnce());
    env.userId = "b";
    env.session = "sb";
    hook.rerender({ controller: current, frame: "b" });
    await act(async () => {
      hold.resolve(book);
      await pending.catch(() => {});
    });
    expect(env.storage.get("a:personal")).toBe(oldLink);
    expect(env.storage.has("b:personal")).toBe(false);
    expect(hook.result.current.message).toBe("");
  });
  it("rejects an old restore callback after switching users", async () => {
    const current = controller(),
      { hook } = setup(current);
    await ready(hook);
    await act(async () => hook.result.current.inspect("remote"));
    const oldRestore = hook.result.current.restore;
    env.userId = "b";
    env.session = "sb";
    hook.rerender({ controller: current, frame: "b" });
    await act(async () => {
      await oldRestore().catch(() => {});
    });
    expect(current.createBook).not.toHaveBeenCalled();
  });
  it("does not restore an old snapshot when identity changes during local book creation", async () => {
    const current = controller(),
      hold = deferred<void>(),
      started = deferred<void>(),
      created: Ledger[] = [];
    vi.mocked(current.createBook).mockImplementation(
      async (_name, ledger, _cloud, prepare?: CreateBookPreparation) => {
        await prepare?.("book:new");
        started.resolve();
        await hold.promise;
        prepare?.assertCurrent?.();
        created.push(ledger!);
        return "book:new";
      },
    );
    const { hook } = setup(current);
    await ready(hook);
    await act(async () => hook.result.current.inspect("remote"));
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.restore();
    });
    await started.promise;
    env.userId = "b";
    env.session = "sb";
    hook.rerender({ controller: current, frame: "b" });
    await act(async () => {
      hold.resolve();
      await pending.catch(() => {});
    });
    expect(created).toEqual([]);
    expect(env.storage.has("a:book:new")).toBe(false);
  });
  it("does not apply a delayed download after A to B to A", async () => {
    const current = controller(),
      hold = deferred<typeof book>(),
      { hook } = setup(current);
    await ready(hook);
    env.load.mockReturnValueOnce(hold.promise);
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.sync();
    });
    await waitFor(() => expect(env.load).toHaveBeenCalled());
    env.userId = "b";
    env.session = "sb";
    hook.rerender({ controller: current, frame: "b" });
    env.userId = "a";
    env.session = "sa";
    hook.rerender({ controller: current, frame: "a2" });
    await act(async () => {
      hold.resolve(book);
      await pending.catch(() => {});
    });
    expect(current.commit).not.toHaveBeenCalled();
  });
  it("does not upload a placeholder ledger while the controller is loading", async () => {
    const current = controller();
    current.isLoading = true;
    const { hook } = setup(current);
    await act(async () => {
      await hook.result.current.upload().catch(() => {});
    });
    expect(env.save).not.toHaveBeenCalled();
  });
  it("cancels automatic sync and blocks manual upload during a controller transition", async () => {
    const current = controller(),
      { hook } = setup(current);
    await ready(hook);
    env.load.mockClear();
    env.save.mockClear();
    vi.useFakeTimers();
    try {
      current.isLoading = true;
      hook.rerender({ controller: current, frame: "loading" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await act(async () => {
        await hook.result.current.upload().catch(() => {});
      });
      expect(env.load).not.toHaveBeenCalled();
      expect(env.save).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
