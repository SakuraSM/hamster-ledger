import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
export function modelSecrets(databasePath) {
  let key;
  function master() {
    if (key) return key;
    if (process.env.LEDGER_MODEL_MASTER_KEY) {
      key = Buffer.from(process.env.LEDGER_MODEL_MASTER_KEY, "base64");
      if (key.length !== 32)
        throw new Error("LEDGER_MODEL_MASTER_KEY 必须是 32 字节的 Base64。");
      return key;
    }
    const file = join(dirname(databasePath), ".model-key");
    try {
      key = readFileSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const generated = randomBytes(32);
      try {
        writeFileSync(file, generated, { flag: "wx", mode: 0o600 });
        key = generated;
      } catch (writeError) {
        if (writeError.code !== "EEXIST") throw writeError;
        key = readFileSync(file);
      }
    }
    if (key.length !== 32) throw new Error("模型密钥文件无效。");
    return key;
  }
  return {
    seal(userId, value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", master(), iv);
      cipher.setAAD(Buffer.from(userId));
      return Buffer.concat([
        iv,
        cipher.update(value, "utf8"),
        cipher.final(),
        cipher.getAuthTag(),
      ]).toString("base64");
    },
    open(userId, value) {
      const bytes = Buffer.from(value, "base64");
      const cipher = createDecipheriv(
        "aes-256-gcm",
        master(),
        bytes.subarray(0, 12),
      );
      cipher.setAAD(Buffer.from(userId));
      cipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([
        cipher.update(bytes.subarray(12, -16)),
        cipher.final(),
      ]).toString("utf8");
    },
  };
}
