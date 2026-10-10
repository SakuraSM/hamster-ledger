import {
  attachmentSchema,
  type Attachment,
  type AttachmentStore,
} from "@hamster-ledger/core";
import { protectedStore } from "./vault";
import { requireStorageLock } from "./storage-coordination";
const KEY = "hamster-ledger.v1.attachments-key";
interface SealedImage {
  key: string;
  bookId: string;
  id: string;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}
function encode(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function dataKey(): Promise<CryptoKey> {
  async function load(): Promise<string> {
    let value = await protectedStore.getItem(KEY);
    if (!value) {
      value = encode(crypto.getRandomValues(new Uint8Array(32)));
      await protectedStore.setItem(KEY, value);
    }
    return value;
  }
  requireStorageLock();
  const value = await navigator.locks.request(
    "hamster-ledger.attachment-key",
    { mode: "exclusive" },
    load,
  );
  return crypto.subtle.importKey("raw", decode(value), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("hamster-ledger-attachments.v1", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("images", {
        keyPath: "key",
      });
      store.createIndex("book", "bookId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
async function request<Result>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", mode);
    const operation = run(transaction.objectStore("images"));
    transaction.oncomplete = () => resolve(operation.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("附件存储中断。"));
  });
}
export async function verifyAttachment(
  attachment: Attachment,
): Promise<Attachment> {
  const parsed = attachmentSchema.parse(attachment);
  const hash = await crypto.subtle.digest("SHA-256", decode(parsed.base64));
  const hex = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (hex !== parsed.hash) throw new Error("附件校验失败，内容已损坏。");
  return parsed;
}
async function unseal(row: SealedImage): Promise<Attachment> {
  const key = await dataKey();
  const bytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: row.iv,
      additionalData: new TextEncoder().encode(row.key),
    },
    key,
    row.ciphertext,
  );
  await protectedStore.getItem(KEY);
  return verifyAttachment(
    JSON.parse(new TextDecoder().decode(bytes)) as Attachment,
  );
}
export const browserAttachments: AttachmentStore = {
  async list(bookId) {
    const rows = await request<SealedImage[]>("readonly", (store) =>
      store.index("book").getAll(bookId),
    );
    return Promise.all(
      rows.map(async (row) => {
        const { base64, ...metadata } = await unseal(row);
        void base64;
        return metadata;
      }),
    );
  },
  async get(bookId, id) {
    const row = await request<SealedImage | undefined>("readonly", (store) =>
      store.get(`${bookId}:${id}`),
    );
    if (!row) throw new Error("附件不存在，请恢复含附件的备份。");
    return unseal(row);
  },
  async put(bookId, attachment) {
    const value = await verifyAttachment(attachment),
      key = await dataKey(),
      iv = crypto.getRandomValues(new Uint8Array(12)),
      rowKey = `${bookId}:${value.id}`;
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(rowKey) },
      key,
      new TextEncoder().encode(JSON.stringify(value)),
    );
    await request("readwrite", (store) =>
      store.put({
        key: rowKey,
        bookId,
        id: value.id,
        iv,
        ciphertext,
      } satisfies SealedImage),
    );
  },
  async remove(bookId, id) {
    await protectedStore.getItem(KEY);
    await request("readwrite", (store) => store.delete(`${bookId}:${id}`));
  },
};
export async function imageAttachment(file: File): Promise<Attachment> {
  if (file.size > 8 * 1024 * 1024) throw new Error("每张图片最大 8 MiB。");
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("请选择 PNG、JPEG、WebP 或 GIF 图片。");
  const bytes = await file.arrayBuffer(),
    hash = await crypto.subtle.digest("SHA-256", bytes);
  return attachmentSchema.parse({
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type,
    hash: Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
    base64: encode(new Uint8Array(bytes)),
    createdAt: Date.now(),
  });
}
