import { writeFile } from "node:fs/promises";
import {
  EMPTY_LEDGER,
  parseRuleText,
  candidateIssues,
  addAiDrafts,
  candidateEntry,
  confirmAiDraft,
} from "../packages/ledger-core/dist/index.js";
const ledger = {
  ...EMPTY_LEDGER,
  accounts: [
    {
      id: "cash",
      name: "虚拟现金",
      type: "现金",
      kind: "asset",
      openingBalance: 100000,
      balanceAt: "2026-01-01 00:00:00",
      aliases: [],
      checkpoints: [],
      isArchived: false,
    },
  ],
};
const samples = [
  {
    id: "decimal",
    text: "虚拟现金 餐饮 12.50元",
    amount: "12.50",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
  },
  {
    id: "explicit-date",
    text: "2026-10-10 虚拟现金 交通 8元",
    amount: "8",
    accountId: "cash",
    date: "2026-10-10 12:00:00",
  },
  {
    id: "unknown-account",
    text: "虚拟陌生账户 餐饮 20元",
    amount: "20",
    accountId: null,
    date: "2026-10-19 12:00:00",
  },
  {
    id: "ambiguous-amount",
    text: "虚拟现金 原价20元，实付18元",
    amount: "",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
    invalid: true,
  },
  {
    id: "negative",
    text: "虚拟现金 餐饮 -12元",
    amount: "-12",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
    invalid: true,
  },
  {
    id: "precision",
    text: "虚拟现金 餐饮 12.345元",
    amount: "12.345",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
    invalid: true,
  },
  {
    id: "zero",
    text: "虚拟现金 餐饮 0元",
    amount: "0",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
    invalid: true,
  },
  {
    id: "unsafe-integer",
    text: "虚拟现金 餐饮 900719925474099100元",
    amount: "900719925474099100",
    accountId: "cash",
    date: "2026-10-19 12:00:00",
    invalid: true,
  },
];
const dimensions = {
  amount: { passed: 0, total: 0 },
  account: { passed: 0, total: 0 },
  date: { passed: 0, total: 0 },
  invalidAmount: { passed: 0, total: 0 },
  duplicate: { passed: 0, total: 1 },
  manualReviewDefault: { passed: 0, total: samples.length },
};
const failures = [];
for (const sample of samples) {
  const [candidate] = parseRuleText(sample.text, ledger, "2026-10-19");
  for (const [dimension, field] of [
    ["amount", "amount"],
    ["account", "accountId"],
    ["date", "date"],
  ]) {
    dimensions[dimension].total++;
    if (candidate[field] === sample[field]) dimensions[dimension].passed++;
    else
      failures.push({
        id: sample.id,
        dimension,
        expected: sample[field],
        actual: candidate[field],
      });
  }
  if (sample.invalid) {
    dimensions.invalidAmount.total++;
    if (candidateIssues(ledger, candidate).includes("金额无效，请核对原始凭证"))
      dimensions.invalidAmount.passed++;
    else failures.push({ id: sample.id, dimension: "invalidAmount" });
  }
  const draft = {
    id: sample.id,
    sourceHash: sample.id,
    source: "text-rule",
    sourceLabel: "合成评估",
    createdAt: "2026-10-19",
    attachmentIds: [],
    state: "pending",
    candidate,
  };
  if (addAiDrafts(ledger, [draft], false).records.length === 0)
    dimensions.manualReviewDefault.passed++;
}
const candidate = parseRuleText(samples[0].text, ledger, "2026-10-19")[0];
const draft = {
  id: "duplicate",
  sourceHash: "synthetic-hash",
  source: "text-rule",
  sourceLabel: "合成评估",
  createdAt: "2026-10-19",
  attachmentIds: [],
  state: "pending",
  candidate,
};
const confirmed = confirmAiDraft(
  addAiDrafts(ledger, [draft], false),
  draft.id,
  candidateEntry(draft),
);
if (
  addAiDrafts(confirmed, [{ ...draft, id: "second" }], false).aiDrafts
    .length === 1
)
  dimensions.duplicate.passed++;
const result = {
  scope:
    "synthetic local rule and draft safety evaluation; no real model or OCR calls",
  sampleCount: samples.length,
  dimensions,
  failures,
  passed: Object.values(dimensions).every(
    (value) => value.passed === value.total,
  ),
};
if (process.argv[2])
  await writeFile(process.argv[2], JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
