import { describe, it, expect } from "vitest";
import {
  createLedgerRepository,
  EMPTY_LEDGER,
  migrateLedger,
  STORAGE_PREFIX,
  type KeyValueStore,
} from "@hamster-ledger/core";
function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
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
describe("portable asynchronous persistence contract", () => {
  it("separates demo and personal ledgers and preserves the prototype storage keys", async () => {
    const store = memoryStore();
    const repository = createLedgerRepository(store);
    await repository.save("personal", EMPTY_LEDGER);
    expect(await repository.load("personal")).toEqual(
      migrateLedger(EMPTY_LEDGER),
    );
    expect(await repository.load("demo")).toBeNull();
    expect(await store.getItem(STORAGE_PREFIX + "personal")).not.toBeNull();
  });
  it("rejects corrupted data without overwriting or returning a success-shaped fallback", async () => {
    const store = memoryStore({ [STORAGE_PREFIX + "personal"]: "{broken" });
    await expect(
      createLedgerRepository(store).load("personal"),
    ).rejects.toThrow();
    expect(await store.getItem(STORAGE_PREFIX + "personal")).toBe("{broken");
  });
  it("rejects unsupported schema versions", async () => {
    const store = memoryStore({
      [STORAGE_PREFIX + "personal"]: JSON.stringify({
        ...EMPTY_LEDGER,
        version: 3,
      }),
    });
    await expect(
      createLedgerRepository(store).load("personal"),
    ).rejects.toThrow();
  });
  it("propagates write failures for platform adapters", async () => {
    const repository = createLedgerRepository({
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error("disk full");
      },
    });
    await expect(repository.save("personal", EMPTY_LEDGER)).rejects.toThrow(
      "disk full",
    );
  });
  it("persists the selected ledger asynchronously", async () => {
    const repository = createLedgerRepository(memoryStore());
    expect(await repository.loadActiveMode()).toBe("demo");
    await repository.saveActiveMode("personal");
    expect(await repository.loadActiveMode()).toBe("personal");
  });
});
it("rejects duplicate book ids and archived built-in books", async () => {
  const repository = createLedgerRepository(memoryStore());
  await expect(
    repository.saveBooks([
      { id: "demo", name: "示例" },
      { id: "personal", name: "个人" },
      { id: "personal", name: "重复" },
    ]),
  ).rejects.toThrow("重复");
  await expect(
    repository.saveBooks([
      { id: "demo", name: "示例", isArchived: true },
      { id: "personal", name: "个人" },
    ]),
  ).rejects.toThrow("默认");
});
