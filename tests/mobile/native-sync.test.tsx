// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EMPTY_LEDGER, type Ledger } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { useNativeSync } from "../../apps/mobile/src/hooks/useNativeSync";
import { serializeSnapshot } from "../../apps/mobile/src/platform/snapshot";
const fixture = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  foreground: "active",
  listeners: new Set<() => void>(),
  client: { books: vi.fn(), load: vi.fn(), save: vi.fn() },
  user: "user",
}));
vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return fixture.foreground;
    },
    addEventListener: (_event: string, listener: () => void) => {
      fixture.listeners.add(listener);
      return { remove: () => fixture.listeners.delete(listener) };
    },
  },
}));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_algorithm: string, value: string) => value,
}));
vi.mock("../../apps/mobile/src/auth/NativeAccount", () => ({
  useNativeAccount: () => ({
    server: "https://synthetic.example",
    credentials: {
      user: { id: fixture.user, mustChangePassword: false },
      session: { id: fixture.user },
    },
    client: fixture.client,
  }),
}));
vi.mock("../../apps/mobile/src/platform/storage", () => ({
  nativeStore: {
    getItem: async (key: string) => fixture.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      fixture.storage.set(key, value);
    },
  },
}));
const key = "hamster.native.sync.https://synthetic.example:user:personal";
const remoteLedger = { ...EMPTY_LEDGER, rules: { 云端: "餐饮" } };
const remote = {
  id: "remote",
  revision: 2,
  name: "云端账本",
  ledger: remoteLedger,
};
function controller(): LedgerController {
  const value: LedgerController = {
    books: [{ id: "personal", name: "本机账本" }],
    mode: "personal",
    ledger: EMPTY_LEDGER,
    personalLedger: EMPTY_LEDGER,
    notice: "",
    error: "",
    isLoading: false,
    isSaving: false,
    canUndo: false,
    createBook: vi.fn(async () => "personal" as const),
    updateBooks: vi.fn(async () => {}),
    switchMode: vi.fn(),
    commit: vi.fn(async (ledger: Ledger) => {
      value.ledger = ledger;
    }),
    decide: vi.fn(),
    undo: vi.fn(),
    editRecord: vi.fn(async () => {}),
    dismissNotice: vi.fn(),
    notify: vi.fn(),
  };
  return value;
}
beforeEach(() => {
  fixture.storage.clear();
  fixture.foreground = "active";
  fixture.user = "user";
  vi.clearAllMocks();
  fixture.client.books.mockResolvedValue({ books: [] });
  fixture.client.load.mockResolvedValue(remote);
  fixture.client.save.mockResolvedValue({ ...remote, revision: 3 });
  fixture.storage.set(
    key,
    JSON.stringify({
      id: "remote",
      revision: 1,
      fingerprint: serializeSnapshot({
        name: "本机账本",
        ledger: EMPTY_LEDGER,
      }),
    }),
  );
});
afterEach(() => {
  cleanup();
  fixture.listeners.clear();
});
async function setup() {
  const value = controller();
  const hook = renderHook(() => useNativeSync({ ...value }));
  await waitFor(() => expect(hook.result.current.link).not.toBeNull());
  return { value, hook };
}
it("pulls a remote-only change while foregrounded without opening the sync screen", async () => {
  const { value, hook } = await setup();
  await waitFor(
    () => expect(value.commit).toHaveBeenCalledWith(remoteLedger, "personal"),
    { timeout: 3000 },
  );
  expect(value.updateBooks).toHaveBeenCalledWith([
    { id: "personal", name: "云端账本" },
  ]);
  expect(hook.result.current.link?.revision).toBe(2);
  expect(fixture.client.save).not.toHaveBeenCalled();
});
it("does not pull while backgrounded and checks immediately on foreground", async () => {
  fixture.foreground = "background";
  const { value } = await setup();
  await act(async () => {
    fixture.listeners.forEach((listener) => listener());
  });
  expect(fixture.client.load).not.toHaveBeenCalled();
  fixture.foreground = "active";
  await act(async () => {
    fixture.listeners.forEach((listener) => listener());
  });
  expect(value.commit).toHaveBeenCalledWith(remoteLedger, "personal");
});
it("retains both versions on conflict and pauses automatic retries", async () => {
  const { value, hook } = await setup();
  value.ledger = { ...EMPTY_LEDGER, rules: { 本机: "购物" } };
  hook.rerender();
  await act(async () => hook.result.current.sync());
  expect(hook.result.current.preview).toEqual(remote);
  expect(value.commit).not.toHaveBeenCalled();
  fixture.client.load.mockClear();
  await act(async () => {
    fixture.listeners.forEach((listener) => listener());
  });
  expect(fixture.client.load).not.toHaveBeenCalled();
  await act(async () => hook.result.current.sync());
  expect(fixture.client.load).toHaveBeenCalledOnce();
});
it("does not overwrite an edit made while loading the remote snapshot", async () => {
  const { value, hook } = await setup();
  let release!: (snapshot: typeof remote) => void;
  fixture.client.load.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.result.current.sync();
  });
  value.ledger = { ...EMPTY_LEDGER, rules: { 正在编辑: "其他" } };
  hook.rerender();
  await act(async () => {
    release(remote);
    await pending;
  });
  expect(value.commit).not.toHaveBeenCalled();
  expect(hook.result.current.link?.revision).toBe(1);
});
it("does not apply an old user's download after identity changes", async () => {
  const { value, hook } = await setup();
  let release!: (snapshot: typeof remote) => void;
  fixture.client.load.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.result.current.sync();
  });
  fixture.user = "another-user";
  hook.rerender();
  await act(async () => {
    release(remote);
    await pending;
  });
  expect(value.commit).not.toHaveBeenCalled();
  expect(hook.result.current.link).toBeNull();
});
it("disconnect removes the checkpoint and stops foreground syncing", async () => {
  const { hook } = await setup();
  await act(async () => hook.result.current.disconnect());
  expect(fixture.storage.get(key)).toBe("");
  await act(async () => {
    fixture.listeners.forEach((listener) => listener());
  });
  expect(fixture.client.load).not.toHaveBeenCalled();
});
