import { validateFinancialIntegrity } from "./financial-integrity.js";
import { z } from "zod";
import { ledgerSchema, recordSchema, type Ledger } from "./model.js";
import { migrateLedger } from "./migration.js";
import { saveAdvancedEntry } from "./advanced-entries.js";

export const BOOK_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type BookRole = (typeof BOOK_ROLES)[number];
export const COLLECTIONS = [
  "records",
  "reviews",
  "accounts",
  "categories",
  "budgets",
  "recurringRules",
  "subscriptions",
  "debts",
  "goals",
  "notifications",
  "aiDrafts",
] as const;
const changeSchema = z.object({
  collection: z.enum(COLLECTIONS),
  id: z.string().min(1),
  value: z.unknown().nullable(),
});
export const ledgerPatchSchema = z
  .object({
    changes: z.array(changeSchema).max(20000),
    rules: z.record(z.string(), z.string()).optional(),
    preferences: ledgerSchema.shape.preferences,
    files: ledgerSchema.shape.files.optional(),
  })
  .strict();
export type LedgerPatch = z.infer<typeof ledgerPatchSchema>;
export interface BookActor {
  userId: string;
  role: BookRole;
}

export function ledgerPatch(before: Ledger, after: Ledger): LedgerPatch {
  const changes: LedgerPatch["changes"] = [];
  for (const collection of COLLECTIONS) {
    const original = new Map(
      (before[collection] ?? []).map((item) => [item.id, item]),
    );
    const updated = new Map(
      (after[collection] ?? []).map((item) => [item.id, item]),
    );
    for (const [id, value] of updated)
      if (JSON.stringify(original.get(id)) !== JSON.stringify(value))
        changes.push({ collection, id, value });
    for (const id of original.keys())
      if (!updated.has(id)) changes.push({ collection, id, value: null });
  }
  return {
    changes,
    ...(JSON.stringify(before.rules) !== JSON.stringify(after.rules)
      ? { rules: after.rules }
      : {}),
    ...(JSON.stringify(before.preferences) !== JSON.stringify(after.preferences)
      ? { preferences: after.preferences }
      : {}),
    ...(JSON.stringify(before.files) !== JSON.stringify(after.files)
      ? { files: after.files }
      : {}),
  };
}
export function applyLedgerPatch(input: {
  ledger: Ledger;
  patch: LedgerPatch;
  actor: BookActor;
}): Ledger {
  const patch = ledgerPatchSchema.parse(input.patch);
  const { actor } = input;
  if (actor.role === "viewer") throw new Error("只读成员不能修改账本。");
  const canManage = actor.role === "owner" || actor.role === "admin";
  if (!canManage && (patch.rules || patch.preferences))
    throw new Error("修改账本配置需要管理员权限。");
  let next = migrateLedger(input.ledger);
  const keys = new Set<string>();
  for (const change of patch.changes) {
    const key = change.collection + ":" + change.id;
    if (keys.has(key)) throw new Error("同一批操作不能重复修改同一对象。");
    keys.add(key);
    if (
      !canManage &&
      !["records", "notifications", "aiDrafts"].includes(change.collection)
    )
      throw new Error("修改共享配置需要管理员权限。");
    if (change.collection === "accounts") {
      const account = next.accounts.find((item) => item.id === change.id);
      if (
        account &&
        (change.value === null ||
          (typeof change.value === "object" &&
            "currency" in change.value &&
            (change.value.currency ?? "CNY") !== (account.currency ?? "CNY")))
      )
        throw new Error("已有账户不能删除或更改币种，请归档后新建。");
    }
    const collection = next[change.collection] ?? [];
    const previous = collection.find((item) => item.id === change.id);
    let value = change.value;
    if (change.collection === "aiDrafts") {
      if (value === null) throw new Error("草稿须标记丢弃以保留识别去重信息。");
      const oldDraft = next.aiDrafts?.find((item) => item.id === change.id);
      if (!canManage && oldDraft && oldDraft.memberId !== actor.userId)
        throw new Error("只能修改自己的草稿。");
      if (value && typeof value === "object")
        value = { ...value, memberId: oldDraft?.memberId ?? actor.userId };
    }
    if (change.collection === "notifications" && !canManage) {
      if (
        !previous ||
        !value ||
        typeof value !== "object" ||
        JSON.stringify({ ...previous, isRead: true }) !==
          JSON.stringify({ ...value, isRead: true })
      )
        throw new Error("成员只能标记通知已读。");
    }
    if (change.collection === "records") {
      if (value === null) throw new Error("账单须移至回收站，不能直接删除。");
      const old = previous ? recordSchema.parse(previous) : null;
      const record = recordSchema.parse(value);
      if (old && !canManage && old.detail?.memberId !== actor.userId)
        throw new Error("成员只能修改自己的记录。");
      if (
        old?.detail?.origin !== "legacy" &&
        old?.detail &&
        (!record.detail || record.detail.origin === "legacy")
      )
        throw new Error("不能将新版交易降级为旧流水。");
      const isLegacy = !record.detail || record.detail.origin === "legacy";
      const normalized = migrateLedger({
        ...next,
        version: 1,
        records: [isLegacy ? { ...record, detail: undefined } : record],
      }).records[0];
      if (
        isLegacy &&
        [record.accountId, record.transferToAccountId].some(
          (id) =>
            id &&
            (next.accounts.find((account) => account.id === id)?.currency ??
              "CNY") !== "CNY",
        )
      )
        throw new Error("外币账户须使用多币种交易。");
      if (!normalized.detail) throw new Error("记录缺少交易信息。");
      value = {
        ...normalized,
        detail: {
          ...normalized.detail,
          attachmentIds: record.detail?.attachmentIds ?? [],
          memberId: old?.detail?.memberId ?? actor.userId,
        },
      };
    }
    if (
      value !== null &&
      (typeof value !== "object" || !("id" in value) || value.id !== change.id)
    )
      throw new Error("操作对象 ID 不匹配。");
    next = ledgerSchema.parse({
      ...next,
      [change.collection]: [
        ...collection.filter((item) => item.id !== change.id),
        ...(value === null ? [] : [value]),
      ],
    });
  }
  next = ledgerSchema.parse({
    ...next,
    ...(patch.rules ? { rules: patch.rules } : {}),
    ...(patch.preferences ? { preferences: patch.preferences } : {}),
    ...(patch.files ? { files: patch.files } : {}),
  });
  // Rebuild account movements from trusted account metadata, never from a client's movement array.
  for (const change of patch.changes.filter(
    (item) => item.collection === "records",
  )) {
    const record = next.records.find((item) => item.id === change.id);
    if (
      !record?.detail ||
      record.detail.origin === "legacy" ||
      record.isDeleted ||
      record.status !== "confirmed"
    )
      continue;
    const recomputed = saveAdvancedEntry(
      {
        ...next,
        records: next.records.filter((item) => item.id !== record.id),
      },
      {
        id: record.id,
        date: record.date,
        merchant: record.merchant,
        category: record.category,
        description: record.description,
        tags: record.tags,
        accountId: record.accountId ?? "",
        transferToAccountId: record.transferToAccountId,
        detail: record.detail,
        adjustmentSign:
          record.detail.type === "adjust" &&
          (record.detail.movements[0]?.amount ?? 0) *
            (next.accounts.find((account) => account.id === record.accountId)
              ?.kind === "liability"
              ? -1
              : 1) <
            0
            ? -1
            : 1,
      },
    ).records.find((item) => item.id === record.id);
    if (!recomputed) throw new Error("交易校验失败。");
    next = {
      ...next,
      records: next.records.map((item) =>
        item.id === record.id
          ? {
              ...record,
              amount: recomputed.amount,
              kind: recomputed.kind,
              detail: recomputed.detail,
            }
          : item,
      ),
    };
  }
  validateFinancialIntegrity(next);
  return next;
}
