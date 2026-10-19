const TAG_BYTES = 16;
const BASE64_CHUNK_SIZE = 8192;
const SALT_BYTES = 16;
import { TextEncoder, TextDecoder } from "@kayahr/text-encoding/no-encodings";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
  getRandomBytesAsync,
} from "expo-crypto";
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
function decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function derive(
  password: string,
  salt: Uint8Array,
): Promise<AESEncryptionKey> {
  archivePassword(password);
  const bytes = await pbkdf2Async(
    sha256,
    new TextEncoder().encode(password),
    salt,
    { c: ARCHIVE_KDF_ITERATIONS, dkLen: 32 },
  );
  try {
    return await AESEncryptionKey.import(bytes);
  } finally {
    bytes.fill(0);
  }
}
export async function encryptArchive(
  text: string,
  password: string,
): Promise<string> {
  const salt = await getRandomBytesAsync(SALT_BYTES);
  const key = await derive(password, salt);
  const sealed = await aesEncryptAsync(new TextEncoder().encode(text), key, {
    nonce: { length: 12 },
    tagLength: TAG_BYTES,
  });
  return JSON.stringify(
    encryptedArchiveSchema.parse({
      format: "hamster-ledger-encrypted",
      version: 1,
      cipher: "AES-256-GCM",
      kdf: "PBKDF2-SHA256",
      iterations: ARCHIVE_KDF_ITERATIONS,
      salt: encode(salt),
      iv: encode(await sealed.iv()),
      ciphertext: encode(await sealed.ciphertext({ includeTag: true })),
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
    const sealed = AESSealedData.fromParts(
      envelope.iv,
      envelope.ciphertext,
      TAG_BYTES,
    );
    return new TextDecoder().decode(await aesDecryptAsync(sealed, key));
  } catch {
    throw new Error("备份密码错误或文件已损坏。");
  }
}
