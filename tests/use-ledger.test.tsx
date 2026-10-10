// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import {
  createLedgerRepository,
  EMPTY_LEDGER,
  migrateLedger,
  type KeyValueStore,
  STORAGE_PREFIX,
} from "@hamster-ledger/core";
import { useLedger } from "../apps/web/src/hooks/useLedger";
afterEach(cleanup);
function store(initial: Record<string, string> = {}): KeyValueStore {
  const items = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return items.get(key) ?? null;
    },
    async setItem(key, value) {
      items.set(key, value);
    },
  };
}
describe("Web adapter consumes asynchronous repository", () => {
  it("loads personal data, commits and undoes to the pre-save snapshot", async () => {
    const persistence = store({ [STORAGE_PREFIX + "active"]: "personal" });
    const repository = createLedgerRepository(persistence);
    const { result } = renderHook(() => useLedger(repository));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const next = { ...EMPTY_LEDGER, rules: { 咖啡: "餐饮" as const } };
    await act(async () => {
      await result.current.commit(next, "personal");
    });
    expect(result.current.personalLedger.rules).toEqual({ 咖啡: "餐饮" });
    act(() => result.current.undo());
    await waitFor(() =>
      expect(result.current.personalLedger.rules).toEqual({}),
    );
    expect(await repository.load("personal")).toEqual(
      migrateLedger(EMPTY_LEDGER),
    );
  });
  it("keeps initialization blocked and does not write over corrupt storage", async () => {
    let writes = 0;
    const repository = createLedgerRepository({
      async getItem(key) {
        return key.endsWith("personal") ? "{broken" : null;
      },
      async setItem() {
        writes++;
      },
    });
    const { result } = renderHook(() => useLedger(repository));
    await waitFor(() => expect(result.current.error).toContain("无法读取"));
    await act(async () => {
      await expect(result.current.commit(EMPTY_LEDGER)).rejects.toThrow();
    });
    expect(writes).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });
  it("does not publish an unsaved snapshot on a failed platform write", async () => {
    const repository = createLedgerRepository({
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error("disk full");
      },
    });
    const { result } = renderHook(() => useLedger(repository));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await expect(
        result.current.commit(
          { ...EMPTY_LEDGER, rules: { 商户: "其他" } },
          "personal",
        ),
      ).rejects.toThrow("disk full");
    });
    expect(result.current.personalLedger).toEqual(EMPTY_LEDGER);
    expect(result.current.error).toContain("未能保存");
  });
});
