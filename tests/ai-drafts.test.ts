import { describe, it, expect } from "vitest";
import {
  EMPTY_LEDGER,
  saveEntry,
  migrateLedger,
  aiCandidateSchema,
  candidateIssues,
  candidateEntry,
  confirmAiDraft,
  addAiDrafts,
  parseRuleText,
  createArchive,
  parseArchive,
  type AiDraft,
  type Ledger,
  type Attachment,
} from "@hamster-ledger/core";
import { restoreArchive } from "@hamster-ledger/ledger-react";
const ledger: Ledger = {
  ...EMPTY_LEDGER,
  accounts: [
    {
      id: "cash",
      name: "虚拟现金",
      kind: "asset",
      type: "现金",
      openingBalance: 10000,
      balanceAt: "2026-01-01 00:00:00",
      aliases: [],
      checkpoints: [],
      isArchived: false,
    },
  ],
};
const draft = (id = "draft-one"): AiDraft => ({
  id,
  sourceHash: "hash-one",
  source: "model-text",
  sourceLabel: "虚拟模型",
  createdAt: "2026-10-03",
  attachmentIds: [],
  state: "pending",
  candidate: aiCandidateSchema.parse({
    type: "expense",
    amount: "10.01",
    currency: "CNY",
    date: "2026-10-03 12:00:00",
    merchant: "虚拟午餐",
    category: "餐饮",
    accountId: "cash",
    confidence: 0.99,
  }),
});
describe("AI draft accounting", () => {
  it("preserves multi-entry text and refuses ambiguous, unsafe or unknown-account amounts", () => {
    expect(
      parseRuleText("虚拟现金 餐饮 12.50元；交通 8元", ledger, "2026-10-03"),
    ).toHaveLength(2);
    for (const amount of ["-1", "0", "12.123", "900719925474099100"])
      expect(
        candidateIssues(ledger, { ...draft().candidate, amount }),
      ).toContain("金额无效，请核对原始凭证");
    expect(
      candidateIssues(ledger, { ...draft().candidate, accountId: "new" }),
    ).toContain("请选择已有账户");
    expect(
      parseRuleText("从虚拟现金支付12元，优惠2元", ledger, "2026-10-03")[0]
        .amount,
    ).toBe("");
  });
  it("default drafts do not move balances and repeated confirmation keeps one record", () => {
    const initial = addAiDrafts(ledger, [draft()], false);
    expect(initial.records).toHaveLength(0);
    const confirmed = confirmAiDraft(
      initial,
      draft().id,
      candidateEntry(draft()),
    );
    expect(confirmed.records[0].amount).toBe(1001);
    expect(
      confirmAiDraft(confirmed, draft().id, candidateEntry(draft())).records,
    ).toHaveLength(1);
    expect(
      addAiDrafts(confirmed, [draft("different-id")], true).records,
    ).toHaveLength(1);
  });
  it("same-day duplicates within an automatic batch and foreign currency stay pending", () => {
    const second = { ...draft("two"), sourceHash: "hash-one" };
    const saved = addAiDrafts(ledger, [draft(), second], true);
    expect(saved.records).toHaveLength(1);
    expect(saved.aiDrafts?.[1].state).toBe("pending");
    expect(() =>
      candidateEntry({
        ...draft(),
        candidate: { ...draft().candidate, currency: "USD" },
      }),
    ).toThrow(/汇率/);
  });
});
it("keeps image identity when a legacy entry changes amount and kind", () => {
  const original = saveEntry(ledger, {
    id: "old",
    date: "2026-10-03 12:00:00",
    merchant: "虚拟旧账单",
    amount: 100,
    kind: "支出",
    category: "餐饮",
    description: "",
    tags: [],
    accountId: "cash",
    transferToAccountId: null,
  });
  const migrated = migrateLedger(original);
  migrated.records[0].detail!.attachmentIds = ["preserved-image"];
  const changed = saveEntry(migrated, {
    id: "old",
    date: "2026-10-03 13:00:00",
    merchant: "虚拟旧账单",
    amount: 200,
    kind: "收入",
    category: "工资",
    description: "",
    tags: [],
    accountId: "cash",
    transferToAccountId: null,
  });
  expect(changed.records[0].detail?.attachmentIds).toEqual(["preserved-image"]);
  expect(changed.records[0].detail?.original.minor).toBe(200);
  expect(changed.records[0].detail?.type).toBe("income");
});
describe("attachment archives", () => {
  const attachment: Attachment = {
    id: "virtual-image",
    name: "凭证.png",
    mime: "image/png",
    hash: "a".repeat(64),
    base64: "YWJj",
    createdAt: 1,
  };
  const withImage: Ledger = {
    ...ledger,
    aiDrafts: [{ ...draft(), attachmentIds: [attachment.id] }],
  };
  it("preserves referenced images, rejects missing images, and still imports v1 JSON", () => {
    const saved = parseArchive(createArchive(withImage, [attachment]));
    expect(saved.attachments[0]).toEqual(attachment);
    expect(saved.ledger.aiDrafts).toEqual(withImage.aiDrafts);
    expect(() => createArchive(withImage, [])).toThrow(/附件缺失/);
    expect(parseArchive(JSON.stringify(EMPTY_LEDGER)).ledger.version).toBe(2);
  });
  it("validates hashes before creating a book and never exposes a partial restore", async () => {
    let created = false;
    const stored = new Set<string>();
    const store = {
      list: async () => [],
      get: async () => attachment,
      put: async () => {
        stored.add(attachment.id);
        throw new Error("disk full");
      },
      remove: async () => {
        stored.delete(attachment.id);
      },
    };
    const createBook = async (
      _name: string,
      _ledger?: Ledger,
      _cloud?: unknown,
      prepare?: (mode: `book:${string}`) => Promise<void>,
    ): Promise<`book:${string}`> => {
      await prepare?.("book:new");
      created = true;
      return "book:new";
    };
    await expect(
      restoreArchive({
        store,
        ledger: withImage,
        attachments: [attachment],
        verify: async () => {
          throw new Error("bad hash");
        },
        createBook,
      }),
    ).rejects.toThrow("bad hash");
    expect(created).toBe(false);
    await expect(
      restoreArchive({
        store,
        ledger: withImage,
        attachments: [attachment],
        verify: async (value) => value,
        createBook,
      }),
    ).rejects.toThrow("disk full");
    expect(created).toBe(false);
    expect(stored.size).toBe(0);
  });
});
