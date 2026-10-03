import { expect, it } from "vitest";
import { decodeStatementText } from "../apps/mobile/src/platform/statement-encoding";
it("decodes UTF-8 including a BOM and preserves supplementary Unicode", () => {
  expect(decodeStatementText(new TextEncoder().encode("\uFEFF交易,𠀀"))).toBe(
    "交易,𠀀",
  );
});
it("decodes GB18030 Chinese and four-byte characters using independently encoded bytes", () => {
  const bytes = new Uint8Array([189, 187, 210, 215, 44, 149, 50, 130, 54]);
  expect(decodeStatementText(bytes)).toBe("交易,𠀀");
});
it("rejects unsupported or malformed input instead of silently replacing characters", () => {
  expect(() => decodeStatementText(new Uint8Array([255, 254, 0]))).toThrow(
    "CSV 编码无法识别",
  );
});
