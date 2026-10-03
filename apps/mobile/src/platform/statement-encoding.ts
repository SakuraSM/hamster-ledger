import { TextDecoder } from "@kayahr/text-encoding/no-encodings";
import "@kayahr/text-encoding/encodings/gb18030";
export function decodeStatementText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("gb18030", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("CSV 编码无法识别，请使用 UTF-8 或 GB18030 导出后重试。");
    }
  }
}
