import { z } from "zod";
export const ARCHIVE_KDF_ITERATIONS = 310000;
export const MAX_ENCRYPTED_ARCHIVE_BYTES = 224 * 1024 * 1024;
export const encryptedArchiveSchema = z.object({
  format: z.literal("hamster-ledger-encrypted"),
  version: z.literal(1),
  cipher: z.literal("AES-256-GCM"),
  kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.literal(ARCHIVE_KDF_ITERATIONS),
  salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
  ciphertext: z
    .string()
    .min(24)
    .max(MAX_ENCRYPTED_ARCHIVE_BYTES)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type EncryptedArchive = z.infer<typeof encryptedArchiveSchema>;
export function archivePassword(password: string): void {
  if (password.length < 8 || password.length > 1024)
    throw new Error("备份密码需要 8–1024 个字符。");
}
export function readEncryptedArchive(text: string): EncryptedArchive | null {
  if (text.length > MAX_ENCRYPTED_ARCHIVE_BYTES)
    throw new Error("备份超过 224 MiB。");
  const value: unknown = JSON.parse(text);
  if (
    value &&
    typeof value === "object" &&
    "format" in value &&
    value.format === "hamster-ledger-encrypted"
  )
    return encryptedArchiveSchema.parse(value);
  return null;
}
