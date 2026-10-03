// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "./helpers/render";
import {
  createStatement,
  mappingNeedsReview,
  parseStatement,
  type StatementFile,
} from "@hamster-ledger/importers";
import { FieldMapping } from "../apps/web/src/components/FieldMapping";
import { ledgerExportRows } from "./helpers/statement-fixture";
afterEach(cleanup);
function MappingHarness({
  initial,
  changed,
}: {
  initial: StatementFile;
  changed: (file: StatementFile) => void;
}): React.JSX.Element {
  const [file, setFile] = useState(initial);
  return (
    <FieldMapping
      file={file}
      onChange={(value) => {
        setFile(value);
        changed(value);
      }}
    />
  );
}
it("supports a manually entered header after row thirty and shows column examples", () => {
  const rows = [
    ...Array.from({ length: 40 }, () => ["说明"]),
    ...ledgerExportRows().slice(10),
  ];
  const initial = {
    ...createStatement({ name: "synthetic.csv", hash: "late", rows }),
    headerIndex: 0,
    mapping: {},
  };
  let latest = initial as StatementFile;
  render(
    <MappingHarness
      initial={initial}
      changed={(value) => {
        latest = value;
      }}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "表头所在行" }), {
    target: { value: "41" },
  });
  fireEvent.click(screen.getByRole("button", { name: "应用表头行" }));
  expect(latest.headerIndex).toBe(40);
  expect(parseStatement(latest, {}).records).toHaveLength(4);
  expect(
    screen.getByRole("region", { name: "表头与原始数据样例" }).textContent,
  ).toContain("合成午餐");
});
it("allows manual amount selection and requires confirmation for content-based guesses", async () => {
  const initial = createStatement({
    name: "custom.csv",
    hash: "guess",
    rows: [
      ["发生时点", "交易对方", "发生数值", "收支"],
      ["2026-09-30", "合成商户", "12.34", "支出"],
    ],
  });
  let latest = initial;
  render(
    <MappingHarness
      initial={initial}
      changed={(value) => {
        latest = value;
      }}
    />,
  );
  expect(mappingNeedsReview(latest)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认字段映射" }));
  expect(mappingNeedsReview(latest)).toBe(false);
  fireEvent.click(screen.getByRole("combobox", { name: "金额" }));
  fireEvent.click(await screen.findByRole("option", { name: "未设置" }));
  expect(parseStatement(latest, {}).records).toHaveLength(0);
  expect(
    (screen.getByRole("button", { name: "确认字段映射" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("combobox", { name: "金额" }));
  fireEvent.click(
    await screen.findByRole("option", {
      name: "第 3 列 · 发生数值 · 例：12.34",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "确认字段映射" }));
  await waitFor(() =>
    expect(parseStatement(latest, {}).records[0].amount).toBe(1234),
  );
  expect(mappingNeedsReview(latest)).toBe(false);
});
