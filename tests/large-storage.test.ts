// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { STORAGE_PREFIX } from "@hamster-ledger/core";
import { installStorageLocks } from "./helpers/storage-locks";
let restoreLocks: () => void;
const key = STORAGE_PREFIX + "personal";
const large = "synthetic-large-ledger:" + "x".repeat(6 * 1024 * 1024);
beforeEach(() => {
  restoreLocks = installStorageLocks();
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(() => {
  restoreLocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("saves and reloads a ledger larger than localStorage without losing legacy entries", async () => {
  localStorage.setItem(key, "legacy");
  const first = await import("../apps/web/src/platform/browser/vault");
  expect(await first.protectedStore.getItem(key)).toBe("legacy");
  await first.protectedStore.setItem(key, large);
  expect(localStorage.getItem(key)!.length).toBeLessThan(200);
  vi.resetModules();
  const second = await import("../apps/web/src/platform/browser/vault");
  expect(await second.protectedStore.getItem(key)).toBe(large);
});
it("preserves the old value when publishing the large value fails", async () => {
  localStorage.setItem(key, "legacy");
  const { protectedStore } =
    await import("../apps/web/src/platform/browser/vault");
  await protectedStore.getItem(key);
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  await expect(protectedStore.setItem(key, large)).rejects.toThrow(
    "storage unavailable",
  );
  spy.mockRestore();
  expect(await protectedStore.getItem(key)).toBe("legacy");
});
it("still rejects stale writes when both clients use large values", async () => {
  const first = await import("../apps/web/src/platform/browser/vault");
  await first.protectedStore.setItem(key, large);
  vi.resetModules();
  const second = await import("../apps/web/src/platform/browser/vault");
  await second.protectedStore.getItem(key);
  await first.protectedStore.setItem(key, large + "updated");
  await expect(
    second.protectedStore.setItem(key, large + "stale"),
  ).rejects.toThrow("另一个页面");
  expect(await first.protectedStore.getItem(key)).toBe(large + "updated");
});
it("encrypts a large ledger and reloads it only after unlocking", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.protectedStore.setItem(key, large);
  await vault.enableVault("synthetic-local-password");
  expect(localStorage.getItem(key)).toBeNull();
  expect(vault.hasVault()).toBe(true);
  await vault.clearVaultSession();
  await expect(vault.protectedStore.getItem(key)).rejects.toThrow("锁定");
  await vault.unlockVault("synthetic-local-password");
  expect(await vault.protectedStore.getItem(key)).toBe(large);
}, 15000);

it("prevents lost updates even when plaintext clients lack Web Locks", async () => {
  restoreLocks();
  const first = await import("../apps/web/src/platform/browser/vault");
  await first.protectedStore.setItem(key, large);
  vi.resetModules();
  const second = await import("../apps/web/src/platform/browser/vault");
  await second.protectedStore.getItem(key);
  const results = await Promise.allSettled([
    first.protectedStore.setItem(key, large + "first"),
    second.protectedStore.setItem(key, large + "second"),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  expect([large + "first", large + "second"]).toContain(
    await first.protectedStore.getItem(key),
  );
});

it("does not treat missing IndexedDB content as an empty ledger", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.protectedStore.setItem(key, large);
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("hamster-ledger-values.v1", 1);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("values", "readwrite");
      transaction.objectStore("values").clear();
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    open.onerror = () => reject(open.error);
  });
  await expect(vault.protectedStore.getItem(key)).rejects.toThrow("数据缺失");
  await expect(
    vault.protectedStore.setItem(key, "replacement"),
  ).rejects.toThrow("数据缺失");
});

it("keeps the previous encrypted vault after a failed large update", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.protectedStore.setItem(key, large);
  await vault.enableVault("synthetic-local-password");
  const before = localStorage.getItem("hamster-ledger.vault.v1");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  await expect(
    vault.protectedStore.setItem(key, large + "unsaved"),
  ).rejects.toThrow("storage unavailable");
  spy.mockRestore();
  expect(localStorage.getItem("hamster-ledger.vault.v1")).toBe(before);
  expect(await vault.protectedStore.getItem(key)).toBe(large);
  await vault.clearVaultSession();
  await vault.unlockVault("synthetic-local-password");
  expect(await vault.protectedStore.getItem(key)).toBe(large);
}, 15000);
