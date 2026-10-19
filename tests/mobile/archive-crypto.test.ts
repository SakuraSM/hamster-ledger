import {
  webcrypto,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createArchive,
  EMPTY_LEDGER,
  parseArchive,
} from "@hamster-ledger/core";
import {
  encryptArchive as webEncrypt,
  decryptArchive as webDecrypt,
} from "../../apps/web/src/platform/browser/archive-crypto";
import {
  encryptArchive as nativeEncrypt,
  decryptArchive as nativeDecrypt,
} from "../../apps/mobile/src/platform/archive-crypto";
// Execute native adapter PBKDF2 with the real portable implementation; substitute
// Node's AES-GCM for the Expo native binding. Device integration is separate QA.
vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: async (size: number) =>
    new Uint8Array(randomBytes(size)),
  AESEncryptionKey: { import: async (bytes: Uint8Array) => Buffer.from(bytes) },
  AESSealedData: {
    fromParts: (iv: string, ciphertext: string) => ({ iv, ciphertext }),
  },
  aesEncryptAsync: async (plaintext: Uint8Array, key: Buffer) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return {
      iv: async () => new Uint8Array(iv),
      ciphertext: async () => new Uint8Array(ciphertext),
    };
  },
  aesDecryptAsync: async (
    sealed: { iv: string; ciphertext: string },
    key: Buffer,
  ) => {
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(sealed.iv, "base64"),
    );
    cipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      cipher.update(bytes.subarray(0, -16)),
      cipher.final(),
    ]);
  },
}));
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
const password = "synthetic-backup-密码";
const plain = createArchive({ ...EMPTY_LEDGER, rules: { 午饭: "餐饮" } }, []);
it("restores encrypted archives in both directions with independent AES implementations", async () => {
  const fromWeb = await webEncrypt(plain, password);
  const fromNative = await nativeEncrypt(plain, password);
  expect(fromWeb).not.toContain("午饭");
  expect(await nativeDecrypt(fromWeb, password)).toBe(plain);
  expect(await webDecrypt(fromNative, password)).toBe(plain);
  expect(fromWeb).not.toBe(await webEncrypt(plain, password));
});
it("rejects wrong passwords, tampering, and unbounded KDF parameters", async () => {
  const encrypted = await webEncrypt(plain, password);
  await expect(nativeDecrypt(encrypted, "wrong-password")).rejects.toThrow(
    "密码错误",
  );
  const envelope = JSON.parse(encrypted);
  const bytes = Buffer.from(envelope.ciphertext, "base64");
  bytes[0] ^= 1;
  await expect(
    webDecrypt(
      JSON.stringify({ ...envelope, ciphertext: bytes.toString("base64") }),
      password,
    ),
  ).rejects.toThrow("文件已损坏");
  await expect(
    webDecrypt(
      JSON.stringify({ ...envelope, iterations: 2147483647 }),
      password,
    ),
  ).rejects.toThrow();
});
it("preserves legacy JSON and plaintext archive restoration", async () => {
  expect(
    parseArchive(await nativeDecrypt(JSON.stringify(EMPTY_LEDGER), "")).ledger
      .records,
  ).toEqual([]);
  expect(parseArchive(await webDecrypt(plain, "")).ledger.rules).toEqual({
    午饭: "餐饮",
  });
  await expect(webEncrypt(plain, "short")).rejects.toThrow("8–1024");
});
