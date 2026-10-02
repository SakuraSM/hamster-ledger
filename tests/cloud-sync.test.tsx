// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { EMPTY_LEDGER, type Ledger } from "@hamster-ledger/core";
import { useLedger } from "../apps/web/src/hooks/useLedger";
import { useCloudSync } from "../apps/web/src/hooks/useCloudSync";
import { cloud } from "../apps/web/src/platform/browser/cloud";
vi.mock("../apps/web/src/platform/browser/cloud", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../apps/web/src/platform/browser/cloud")
    >();
  return {
    ...actual,
    cloud: { me: vi.fn(), books: vi.fn(), save: vi.fn(), load: vi.fn() },
  };
});
let remote: {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  ledger: Ledger;
};
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.clearAllMocks();
  remote = {
    id: "remote",
    name: "我的账本",
    revision: 1,
    updatedAt: "2026-10-02",
    ledger: EMPTY_LEDGER,
  };
  vi.mocked(cloud.me).mockResolvedValue({
    user: { id: "user", username: "qa" },
  });
  vi.mocked(cloud.books).mockImplementation(async () => ({
    books: [{ ...remote }],
  }));
  vi.mocked(cloud.save).mockImplementation(async (input) => {
    remote = {
      ...remote,
      name: input.name,
      ledger: input.ledger,
      revision: input.id ? remote.revision + 1 : 1,
    };
    return { ...remote };
  });
  vi.mocked(cloud.load).mockImplementation(async () => structuredClone(remote));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function useWorkspace() {
  const controller = useLedger();
  const sync = useCloudSync(controller);
  return { controller, sync };
}
async function linkedWorkspace() {
  const hook = renderHook(useWorkspace);
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  await waitFor(() => expect(hook.result.current.sync.user).not.toBeNull());
  act(() => hook.result.current.controller.switchMode("personal"));
  await act(async () => hook.result.current.sync.upload());
  return hook;
}
it("automatically uploads after an asynchronous local save finishes", async () => {
  const hook = await linkedWorkspace();
  await act(async () =>
    hook.result.current.controller.commit({
      ...EMPTY_LEDGER,
      rules: { 午餐: "餐饮" },
    }),
  );
  await waitFor(() => expect(remote.ledger.rules).toEqual({ 午餐: "餐饮" }), {
    timeout: 3500,
  });
  expect(remote.revision).toBe(2);
});
it("retains both versions when local and cloud changes conflict", async () => {
  const hook = await linkedWorkspace();
  remote = {
    ...remote,
    revision: 2,
    ledger: { ...EMPTY_LEDGER, rules: { 云端: "购物" } },
  };
  await act(async () =>
    hook.result.current.controller.commit({
      ...EMPTY_LEDGER,
      rules: { 本机: "餐饮" },
    }),
  );
  await act(async () => {
    await expect(hook.result.current.sync.sync()).rejects.toThrow(
      "两边数据已保留",
    );
  });
  expect(hook.result.current.controller.ledger.rules).toEqual({ 本机: "餐饮" });
  expect(remote.ledger.rules).toEqual({ 云端: "购物" });
  expect(hook.result.current.sync.preview?.revision).toBe(2);
});
it("downloads a remote-only change into an unchanged linked book", async () => {
  const hook = await linkedWorkspace();
  remote = {
    ...remote,
    revision: 2,
    ledger: { ...EMPTY_LEDGER, rules: { 云端: "购物" } },
  };
  await act(async () => hook.result.current.sync.sync());
  expect(hook.result.current.controller.ledger.rules).toEqual({ 云端: "购物" });
});
