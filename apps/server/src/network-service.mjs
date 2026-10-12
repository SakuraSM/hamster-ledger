import { createHash, randomUUID } from "node:crypto";
import {
  migrateLedger,
  ledgerPatchSchema,
  applyLedgerPatch,
  ledgerPatch,
} from "@hamster-ledger/core";
import { HttpError } from "./http.mjs";
export const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export async function transaction(database, action) {
  return await database.transaction(action);
}
export async function membership(database, bookId, userId) {
  if (database.isInTransaction()) await database.lockBook(bookId);
  const member = await database
    .prepare("SELECT role FROM book_members WHERE book_id=$1 AND user_id=$2")
    .get(bookId, userId);
  const book = await database
    .prepare("SELECT * FROM books WHERE id=$1 AND authority='server'")
    .get(bookId);
  if (!member || !book)
    throw new HttpError(404, "联网账本不存在或已失去权限。");
  return { book, role: member.role, userId };
}
export function snapshot(access) {
  return {
    id: access.book.id,
    name: access.book.name,
    revision: access.book.revision,
    updatedAt: access.book.updated_at,
    role: access.role,
    ledger: migrateLedger(JSON.parse(access.book.ledger)),
  };
}
export function requireManager(access, ownerOnly = false) {
  if (
    !(ownerOnly
      ? access.role === "owner"
      : ["owner", "admin"].includes(access.role))
  )
    throw new HttpError(403, "需要账本管理权限。");
}
// Membership changes have their own audit entries and cannot be undone as ledger patches.
export async function auditMembership(
  database,
  bookId,
  userId,
  summary,
  now,
  source = "membership",
) {
  const book = await database
    .prepare("SELECT revision FROM books WHERE id=$1")
    .get(bookId);
  await database
    .prepare("INSERT INTO book_operations VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
    .run(
      randomUUID(),
      bookId,
      userId,
      source,
      summary,
      book.revision,
      "null",
      new Date(now()).toISOString(),
    );
}
export async function applyOperation({
  database,
  bookId,
  userId,
  body,
  now,
  source = "app",
  command,
  revalidate,
}) {
  if (typeof body.key !== "string" || !/^[A-Za-z0-9:_-]{8,160}$/.test(body.key))
    throw new HttpError(400, "缺少有效的幂等键。");
  if (!Number.isSafeInteger(body.revision))
    throw new HttpError(400, "缺少账本版本。");
  const payload = digest(
    command ? { command } : { patch: body.patch, undoId: body.undoId },
  );
  return await transaction(database, async () => {
    await database.lockBook(bookId);
    await revalidate?.();
    const access = await membership(database, bookId, userId);
    if (access.role === "viewer")
      throw new HttpError(403, "只读成员不能写入。");
    const previous = await database
      .prepare(
        "SELECT digest,result FROM book_requests WHERE book_id=$1 AND user_id=$2 AND request_key=$3",
      )
      .get(bookId, userId, body.key);
    if (previous) {
      if (previous.digest !== payload)
        throw new HttpError(409, "幂等键已用于另一项操作。");
      return JSON.parse(previous.result);
    }
    if (access.book.revision !== body.revision)
      throw new HttpError(
        409,
        "账本已有更新，请刷新后重新提交。",
        "revision_conflict",
      );
    const before = migrateLedger(JSON.parse(access.book.ledger));
    let patch = body.patch;
    if (body.undoId) {
      const operation = await database
        .prepare("SELECT * FROM book_operations WHERE id=$1 AND book_id=$2")
        .get(body.undoId, bookId);
      if (
        !operation ||
        operation.before_json === "null" ||
        operation.revision !== access.book.revision
      )
        throw new HttpError(409, "只能撤销当前最新操作，请先查看历史。");
      if (
        operation.user_id !== userId &&
        !["owner", "admin"].includes(access.role)
      )
        throw new HttpError(403, "不能撤销其他成员的操作。");
      patch = ledgerPatch(before, JSON.parse(operation.before_json));
      patch.changes = patch.changes.map((change) =>
        change.collection === "records" && change.value === null
          ? {
              ...change,
              value: {
                ...before.records.find((record) => record.id === change.id),
                isDeleted: true,
              },
            }
          : change.collection === "aiDrafts" && change.value === null
            ? {
                ...change,
                value: {
                  ...before.aiDrafts.find((draft) => draft.id === change.id),
                  state: "discarded",
                },
              }
            : change.collection === "accounts" && change.value === null
              ? {
                  ...change,
                  value: {
                    ...before.accounts.find(
                      (account) => account.id === change.id,
                    ),
                    isArchived: true,
                  },
                }
              : change,
      );
    }
    let next;
    try {
      next = applyLedgerPatch({
        ledger: before,
        patch: ledgerPatchSchema.parse(patch),
        actor: { userId, role: access.role },
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "操作无效。",
      );
    }
    for (const record of next.records) {
      const previousRecord = before.records.find(
        (item) => item.id === record.id,
      );
      if (
        JSON.stringify(previousRecord?.detail?.splits) ===
        JSON.stringify(record.detail?.splits)
      )
        continue;
      for (const split of record.detail?.splits ?? [])
        if (
          !(await database
            .prepare(
              "SELECT 1 FROM book_members WHERE book_id=$1 AND user_id=$2",
            )
            .get(bookId, split.memberId))
        )
          throw new HttpError(400, "AA 分摊须选择当前账本成员。");
    }
    const attachmentIds = new Set([
      ...next.records.flatMap((record) => record.detail?.attachmentIds ?? []),
      ...(next.aiDrafts ?? [])
        .filter((draft) => draft.state === "pending")
        .flatMap((draft) => draft.attachmentIds),
    ]);
    for (const id of attachmentIds)
      if (
        !(await database
          .prepare("SELECT 1 FROM attachments WHERE id=$1 AND book_id=$2")
          .get(id, bookId))
      )
        throw new HttpError(400, "附件不存在或不属于当前账本。");
    const revision = access.book.revision + 1;
    const at = new Date(now()).toISOString();
    const operationId = randomUUID();
    await database
      .prepare(
        "UPDATE books SET ledger=$1,revision=$2,updated_at=$3 WHERE id=$4",
      )
      .run(JSON.stringify(next), revision, at, bookId);
    await database
      .prepare("INSERT INTO book_operations VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
      .run(
        operationId,
        bookId,
        userId,
        source,
        body.undoId
          ? "撤销操作"
          : source === "scheduler"
            ? "自动记账与提醒"
            : `修改 ${patch.changes.length} 项`,
        revision,
        JSON.stringify(before),
        at,
      );
    if (source === "scheduler")
      for (const record of next.records) {
        if (
          (record.detail?.subscriptionId || record.recurringRuleId) &&
          !before.records.some((item) => item.id === record.id)
        )
          await database
            .prepare(
              "INSERT INTO scheduler_runs(book_id,occurrence) VALUES($1,$2) ON CONFLICT DO NOTHING",
            )
            .run(bookId, record.id);
      }
    const result = {
      ...snapshot(access),
      revision,
      updatedAt: at,
      ledger: next,
      operationId,
    };
    await database
      .prepare("INSERT INTO book_requests VALUES($1,$2,$3,$4,$5)")
      .run(bookId, userId, body.key, payload, JSON.stringify(result));
    return result;
  });
}
