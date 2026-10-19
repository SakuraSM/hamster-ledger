import { expect, it } from "vitest";
import {
  createStatement,
  rememberMapping,
  reuseMapping,
  mappingNeedsReview,
  importErrorReport,
  parseStatement,
} from "@hamster-ledger/importers";
import type { KeyValueStore } from "@hamster-ledger/core";
it("reuses only the same source and header shape and still requires confirmation", async () => {
  const values = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
  const file = createStatement({
    name: "synthetic.csv",
    hash: "hash",
    rows: [
      ["日期", "金额", "商户"],
      ["2026-10-01", "12", "虚拟商户"],
    ],
  });
  const confirmed = { ...file, mappingConfirmed: true };
  await rememberMapping(store, confirmed);
  const reused = await reuseMapping(store, { ...file, hash: "next" });
  expect(reused.mapping).toEqual(file.mapping);
  expect(mappingNeedsReview(reused)).toBe(true);
  expect(reused.account).toBe(file.account);
  const other = { ...file, source: "微信支付" as const };
  expect(await reuseMapping(store, other)).toBe(other);
  values.forEach((_value, key) => values.set(key, "broken"));
  expect(await reuseMapping(store, file)).toBe(file);
});
it("exports erroneous original rows with file fingerprint for traceability", () => {
  const file = createStatement({
    name: "synthetic.csv",
    hash: "sha-test",
    rows: [
      ["日期", "金额", "商户"],
      ["2026-10-01", "invalid", "虚拟错误行"],
    ],
  });
  const report = importErrorReport([{ file, ...parseStatement(file, {}) }]);
  expect(report).toContain("sha-test");
  expect(report).toContain("原始行");
  expect(report).toContain("虚拟错误行");
});
