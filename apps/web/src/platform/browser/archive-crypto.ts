const BASE64_CHUNK_SIZE = 8192;
const SALT_BYTES = 16;
import {
  ARCHIVE_KDF_ITERATIONS,
  archivePassword,
  encryptedArchiveSchema,
  readEncryptedArchive,
} from "@hamster-ledger/core";
function encode(bytes: Uint8Array): string {
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE)
    value += String.fromCharCode(
      ...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE),
    );
  return btoa(value);
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  archivePassword(password);
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
      salt,
      iterations: ARCHIVE_KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptArchive(
  text: string,
  password: string,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  return JSON.stringify(
    encryptedArchiveSchema.parse({
      format: "hamster-ledger-encrypted",
      version: 1,
      cipher: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: ARCHIVE_KDF_ITERATIONS,
      salt: encode(salt),
      iv: encode(iv),
      ciphertext: encode(new Uint8Array(ciphertext)),
    }),
  );
}
export async function decryptArchive(
  text: string,
  password: string,
): Promise<string> {
  const envelope = readEncryptedArchive(text);
  if (!envelope) return text;
  try {
    const key = await derive(password, decode(envelope.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(envelope.iv) },
      key,
      decode(envelope.ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("备份密码错误或文件已损坏。");
  }
}
