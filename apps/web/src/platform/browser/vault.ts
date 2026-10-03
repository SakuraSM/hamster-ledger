import { requireStorageLock, withStorageLock } from "./storage-coordination";
const IV_BYTES = 12;
const MIN_PASSWORD_LENGTH = 8;
const SALT_BYTES = 16;
import { STORAGE_PREFIX, type KeyValueStore } from "@hamster-ledger/core";
const VAULT_KEY = "hamster-ledger.vault.v1";
const ITERATIONS = 310000;
interface Envelope {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}
let unlockedKey: CryptoKey | null = null;
let unlockedEntries: Record<string, string> | null = null;
let salt = "";
let envelopeSnapshot: string | null = null;
const plainSnapshots = new Map<string, string | null>();
const CONCURRENT_CHANGE =
  "另一个页面已修改账本，请刷新后重试；当前修改尚未保存。";
let queue: Promise<void> = Promise.resolve();
function encode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
async function derive(password: string, saltValue: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: decode(saltValue),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function encrypt({
  entries,
  key,
  saltValue,
}: {
  entries: Record<string, string>;
  key: CryptoKey;
  saltValue: string;
}): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(entries)),
  );
  return JSON.stringify({
    version: 1,
    salt: saltValue,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(bytes)),
  } satisfies Envelope);
}
export function hasVault(): boolean {
  return localStorage.getItem(VAULT_KEY) !== null;
}
export async function unlockVault(password: string): Promise<void> {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error("加密账本不存在。");
  try {
    const envelope: Envelope = JSON.parse(raw);
    if (envelope.version !== 1) throw new Error("version");
    const key = await derive(password, envelope.salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(envelope.iv) },
      key,
      decode(envelope.ciphertext),
    );
    const entries: unknown = JSON.parse(new TextDecoder().decode(plain));
    if (
      !entries ||
      typeof entries !== "object" ||
      Array.isArray(entries) ||
      !Object.values(entries).every((value) => typeof value === "string")
    )
      throw new Error("format");
    unlockedEntries = entries as Record<string, string>;
    unlockedKey = key;
    salt = envelope.salt;
    envelopeSnapshot = raw;
  } catch {
    throw new Error("密码错误或加密数据损坏。");
  }
}
async function exclusive(write: () => Promise<void>): Promise<void> {
  const operation = queue.then(() => withStorageLock(write));
  queue = operation.catch(() => undefined);
  return operation;
}
function readPlainEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX))
      entries[key] = localStorage.getItem(key) ?? "";
  }
  return entries;
}
export async function enableVault(password: string): Promise<void> {
  requireStorageLock();
  return exclusive(async () => {
    if (password.length < MIN_PASSWORD_LENGTH)
      throw new Error("解锁密码至少 8 个字符。");
    if (hasVault()) throw new Error("已经启用密码保护。");
    for (const [key, value] of plainSnapshots) {
      if (key.startsWith(STORAGE_PREFIX) && localStorage.getItem(key) !== value)
        throw new Error(CONCURRENT_CHANGE);
    }
    const entries = readPlainEntries();
    const newSalt = encode(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
    const key = await derive(password, newSalt);
    const encrypted = await encrypt({ entries, key, saltValue: newSalt });
    const latest = readPlainEntries();
    if (
      hasVault() ||
      Object.keys(entries).length !== Object.keys(latest).length ||
      Object.entries(entries).some(([key, value]) => latest[key] !== value)
    )
      throw new Error(CONCURRENT_CHANGE);
    localStorage.setItem(VAULT_KEY, encrypted);
    envelopeSnapshot = encrypted;
    unlockedKey = key;
    unlockedEntries = entries;
    salt = newSalt;
    for (const entryKey of Object.keys(entries))
      localStorage.removeItem(entryKey);
  });
}
export async function clearVaultSession(): Promise<void> {
  await queue;
  unlockedKey = null;
  unlockedEntries = null;
  envelopeSnapshot = null;
}
export async function lockVault(): Promise<void> {
  await clearVaultSession();
  window.location.reload();
}
export const protectedStore: KeyValueStore = {
  async getItem(key): Promise<string | null> {
    if (!hasVault()) {
      const value = localStorage.getItem(key);
      plainSnapshots.set(key, value);
      return value;
    }
    if (!unlockedEntries) throw new Error("账本已锁定。");
    return unlockedEntries[key] ?? null;
  },
  async setItem(key, value): Promise<void> {
    return exclusive(async () => {
      if (!hasVault()) {
        if (
          plainSnapshots.has(key) &&
          localStorage.getItem(key) !== plainSnapshots.get(key)
        )
          throw new Error(CONCURRENT_CHANGE);
        localStorage.setItem(key, value);
        plainSnapshots.set(key, value);
        return;
      }
      if (!unlockedEntries || !unlockedKey) throw new Error("账本已锁定。");
      requireStorageLock();
      if (unlockedEntries[key] === value) return;
      const previous = localStorage.getItem(VAULT_KEY);
      if (previous !== envelopeSnapshot) throw new Error(CONCURRENT_CHANGE);
      const next = { ...unlockedEntries, [key]: value };
      const encrypted = await encrypt({
        entries: next,
        key: unlockedKey,
        saltValue: salt,
      });
      if (localStorage.getItem(VAULT_KEY) !== previous)
        throw new Error(CONCURRENT_CHANGE);
      localStorage.setItem(VAULT_KEY, encrypted);
      envelopeSnapshot = encrypted;
      unlockedEntries = next;
    });
  },
};
