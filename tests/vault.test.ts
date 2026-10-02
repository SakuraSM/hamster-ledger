// @vitest-environment jsdom
import { installStorageLocks } from "./helpers/storage-locks";
let restoreLocks: () => void;
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { STORAGE_PREFIX } from "@hamster-ledger/core";
beforeEach(() => {
  restoreLocks = installStorageLocks();
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  restoreLocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("encrypts all ledger keys and reloads only after the correct password", async () => {
  const key = STORAGE_PREFIX + "personal";
  localStorage.setItem(key, "private-test-ledger");
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.enableVault("local-test-password");
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem("hamster-ledger.vault.v1")).not.toContain(
    "private-test-ledger",
  );
  vi.resetModules();
  const fresh = await import("../apps/web/src/platform/browser/vault");
  await expect(fresh.protectedStore.getItem(key)).rejects.toThrow("锁定");
  await expect(fresh.unlockVault("wrong-password")).rejects.toThrow("密码错误");
  await fresh.unlockVault("local-test-password");
  expect(await fresh.protectedStore.getItem(key)).toBe("private-test-ledger");
});
it("serializes concurrent encrypted writes and retains original plaintext when encryption cannot persist", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  localStorage.setItem(STORAGE_PREFIX + "personal", "old");
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  await expect(vault.enableVault("local-test-password")).rejects.toThrow(
    "quota",
  );
  spy.mockRestore();
  expect(localStorage.getItem(STORAGE_PREFIX + "personal")).toBe("old");
  await vault.enableVault("local-test-password");
  await Promise.all([
    vault.protectedStore.setItem("one", "1"),
    vault.protectedStore.setItem("two", "2"),
  ]);
  expect(await vault.protectedStore.getItem("one")).toBe("1");
  expect(await vault.protectedStore.getItem("two")).toBe("2");
});
it("rejects a stale encrypted write after another tab updates the envelope", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.enableVault("local-test-password");
  const previous = localStorage.getItem("hamster-ledger.vault.v1");
  localStorage.setItem("hamster-ledger.vault.v1", "another-tab-envelope");
  await expect(vault.protectedStore.setItem("test", "value")).rejects.toThrow(
    "另一个页面",
  );
  expect(localStorage.getItem("hamster-ledger.vault.v1")).not.toBe(previous);
});
it("rejects stale plaintext writes from another tab", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  await vault.protectedStore.getItem("shared-key");
  localStorage.setItem("shared-key", "other-tab-value");
  await expect(
    vault.protectedStore.setItem("shared-key", "this-tab-value"),
  ).rejects.toThrow("另一个页面");
  expect(localStorage.getItem("shared-key")).toBe("other-tab-value");
});
it("uses the same sync fingerprint for equivalent objects regardless of key order", async () => {
  const { fingerprint } =
    await import("../apps/web/src/platform/browser/sync-link");
  expect(
    await fingerprint({
      name: "测试",
      ledger: { records: [], rules: { A: "a", B: "b" } },
    }),
  ).toBe(
    await fingerprint({
      ledger: { rules: { B: "b", A: "a" }, records: [] },
      name: "测试",
    }),
  );
});
it("aborts encryption migration without removing a concurrent plaintext write", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  const key = STORAGE_PREFIX + "personal";
  localStorage.setItem(key, "initial-ledger");
  let reached!: () => void;
  const entered = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = webcrypto.subtle.deriveKey.bind(webcrypto.subtle);
  const spy = vi
    .spyOn(webcrypto.subtle, "deriveKey")
    .mockImplementation(async (...args) => {
      reached();
      await gate;
      return original(...args);
    });
  const migration = vault.enableVault("local-test-password");
  await entered;
  localStorage.setItem(key, "saved-by-another-tab");
  release();
  try {
    await expect(migration).rejects.toThrow("另一个页面");
    expect(localStorage.getItem(key)).toBe("saved-by-another-tab");
    expect(vault.hasVault()).toBe(false);
  } finally {
    spy.mockRestore();
  }
});
it("does not migrate a newer ledger behind an already-loaded stale tab", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  const key = STORAGE_PREFIX + "personal";
  localStorage.setItem(key, "initial");
  await vault.protectedStore.getItem(key);
  localStorage.setItem(key, "another-tab");
  await expect(vault.enableVault("local-test-password")).rejects.toThrow(
    "另一个页面",
  );
  expect(localStorage.getItem(key)).toBe("another-tab");
  expect(vault.hasVault()).toBe(false);
});
it("shares the write lock between independent clients during encryption migration", async () => {
  const key = STORAGE_PREFIX + "personal";
  localStorage.setItem(key, "initial");
  const first = await import("../apps/web/src/platform/browser/vault");
  vi.resetModules();
  const second = await import("../apps/web/src/platform/browser/vault");
  await second.protectedStore.getItem(key);
  let reached!: () => void;
  const entered = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = webcrypto.subtle.deriveKey.bind(webcrypto.subtle);
  vi.spyOn(webcrypto.subtle, "deriveKey").mockImplementation(
    async (...args) => {
      reached();
      await gate;
      return original(...args);
    },
  );
  const migration = first.enableVault("local-test-password");
  await entered;
  const write = expect(
    second.protectedStore.setItem(key, "late-write"),
  ).rejects.toThrow("锁定");
  release();
  await migration;
  await write;
  expect(await first.protectedStore.getItem(key)).toBe("initial");
});
it("does not rewrite an encrypted envelope for an unchanged sync cursor", async () => {
  const vault = await import("../apps/web/src/platform/browser/vault");
  const key = STORAGE_PREFIX + "sync.cursor";
  localStorage.setItem(key, "same-value");
  await vault.enableVault("local-test-password");
  const before = localStorage.getItem("hamster-ledger.vault.v1");
  await vault.protectedStore.setItem(key, "same-value");
  expect(localStorage.getItem("hamster-ledger.vault.v1")).toBe(before);
});
it("keeps plaintext when cross-tab locking is unavailable", async () => {
  restoreLocks();
  const vault = await import("../apps/web/src/platform/browser/vault");
  const key = STORAGE_PREFIX + "personal";
  localStorage.setItem(key, "original");
  await expect(vault.enableVault("local-test-password")).rejects.toThrow(
    "不支持跨页面",
  );
  expect(localStorage.getItem(key)).toBe("original");
  expect(vault.hasVault()).toBe(false);
});
