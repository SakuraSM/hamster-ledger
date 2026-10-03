// @vitest-environment jsdom
import { webcrypto, createHash } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { installStorageLocks } from "./helpers/storage-locks";
import type { Attachment } from "@hamster-ledger/core";
let restoreLocks: () => void;
const attachment: Attachment = {
  id: "virtual-image",
  name: "虚拟私人凭证.png",
  mime: "image/png",
  base64: "YWJj",
  hash: createHash("sha256").update("abc").digest("hex"),
  createdAt: 1,
};
beforeEach(() => {
  restoreLocks = installStorageLocks();
  localStorage.clear();
  vi.resetModules();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(() => {
  restoreLocks();
  vi.unstubAllGlobals();
});
it("stores only authenticated ciphertext in IndexedDB and the vault gates image access", async () => {
  const { browserAttachments } =
    await import("../apps/web/src/platform/browser/attachments");
  const vault = await import("../apps/web/src/platform/browser/vault");
  await browserAttachments.put("personal", attachment);
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open("hamster-ledger-attachments.v1", 1);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction("images").objectStore("images").getAll();
      read.onsuccess = () => {
        resolve(read.result);
        db.close();
      };
      read.onerror = () => reject(read.error);
    };
  });
  expect(JSON.stringify(rows)).not.toContain(attachment.name);
  expect(JSON.stringify(rows)).not.toContain(attachment.base64);
  await vault.enableVault("synthetic-local-password");
  expect(localStorage.getItem("hamster-ledger.v1.attachments-key")).toBeNull();
  await vault.clearVaultSession();
  await expect(
    browserAttachments.get("personal", attachment.id),
  ).rejects.toThrow("锁定");
  await vault.unlockVault("synthetic-local-password");
  expect(await browserAttachments.get("personal", attachment.id)).toEqual(
    attachment,
  );
  await expect(
    browserAttachments.get("book:other", attachment.id),
  ).rejects.toThrow("不存在");
});
it("rejects corrupt backup payloads before writing or changing existing attachments", async () => {
  const { browserAttachments } =
    await import("../apps/web/src/platform/browser/attachments");
  await browserAttachments.put("personal", attachment);
  await expect(
    browserAttachments.put("personal", { ...attachment, base64: "YmFk" }),
  ).rejects.toThrow("校验失败");
  expect(await browserAttachments.get("personal", attachment.id)).toEqual(
    attachment,
  );
});
