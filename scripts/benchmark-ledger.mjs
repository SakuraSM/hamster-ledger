import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import {
  EMPTY_LEDGER,
  summarize,
  createArchive,
  parseArchive,
} from "../packages/ledger-core/dist/index.js";
import {
  createStatement,
  parseStatement,
} from "../packages/statement-importers/dist/index.js";
const results = [];
for (const count of [1000, 5000, 14999]) {
  const rows = [
    ["日期", "金额", "商户", "收支"],
    ...Array.from({ length: count }, (_, index) => [
      "2026-10-01 12:00:00",
      "1.00",
      `合成商户${index}`,
      "支出",
    ]),
  ];
  const times = { parse: [], summary: [], archive: [], restore: [] };
  let bytes = 0;
  for (let sample = 0; sample < 6; sample++) {
    let start = performance.now();
    const statement = createStatement({
      name: "synthetic.csv",
      hash: `synthetic-${count}`,
      rows,
    });
    const parsed = parseStatement(statement, {});
    const parseTime = performance.now() - start;
    if (parsed.errors.length || parsed.records.length !== count)
      throw new Error("Synthetic parse fixture failed");
    const ledger = {
      ...EMPTY_LEDGER,
      records: parsed.records.map((record) => ({
        ...record,
        status: "confirmed",
      })),
    };
    start = performance.now();
    const summary = summarize(ledger.records);
    const summaryTime = performance.now() - start;
    if (summary.expense !== count * 100)
      throw new Error("Summary correctness failed");
    start = performance.now();
    const archive = createArchive(ledger, []);
    const archiveTime = performance.now() - start;
    start = performance.now();
    const restored = parseArchive(archive);
    const restoreTime = performance.now() - start;
    if (restored.ledger.records.length !== count)
      throw new Error("Restore correctness failed");
    bytes = Buffer.byteLength(archive);
    if (sample) {
      times.parse.push(parseTime);
      times.summary.push(summaryTime);
      times.archive.push(archiveTime);
      times.restore.push(restoreTime);
    }
  }
  results.push({
    count,
    attachmentCount: 0,
    bytes,
    samples: 5,
    milliseconds: Object.fromEntries(
      Object.entries(times).map(([key, values]) => [
        key,
        {
          median: Number([...values].sort((a, b) => a - b)[2].toFixed(2)),
          maximum: Number(Math.max(...values).toFixed(2)),
        },
      ]),
    ),
  });
}
const report = {
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  scope:
    "synthetic in-process baseline; excludes UI, network, encryption and attachments; one warmup per size",
  results,
};
if (process.argv[2])
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
