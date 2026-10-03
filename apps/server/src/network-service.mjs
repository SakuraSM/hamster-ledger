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
export function transaction(database, action) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
export function membership(database, bookId, userId) {
  const member = database
    .prepare("SELECT role FROM book_members WHERE book_id=? AND user_id=?")
    .get(bookId, userId);
  const book = database
    .prepare("SELECT * FROM books WHERE id=? AND authority='server'")
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
export function auditMembership(database, bookId, userId, summary, now) {
  const book = database
    .prepare("SELECT revision FROM books WHERE id=?")
    .get(bookId);
  database
    .prepare("INSERT INTO book_operations VALUES(?,?,?,?,?,?,?,?)")
    .run(
      randomUUID(),
      bookId,
      userId,
      "membership",
      summary,
      book.revision,
      "null",
      new Date(now()).toISOString(),
    );
}
export function applyOperation({
  database,
  bookId,
  userId,
  body,
  now,
  source = "app",
}) {
  if (typeof body.key !== "string" || !/^[A-Za-z0-9:_-]{8,160}$/.test(body.key))
    throw new HttpError(400, "缺少有效的幂等键。");
  if (!Number.isSafeInteger(body.revision))
    throw new HttpError(400, "缺少账本版本。");
  const payload = digest({ patch: body.patch, undoId: body.undoId });
  return transaction(database, () => {
    const access = membership(database, bookId, userId);
    if (access.role === "viewer")
      throw new HttpError(403, "只读成员不能写入。");
    const previous = database
      .prepare(
        "SELECT digest,result FROM book_requests WHERE book_id=? AND user_id=? AND request_key=?",
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
      const operation = database
        .prepare("SELECT * FROM book_operations WHERE id=? AND book_id=?")
        .get(body.undoId, bookId);
      if (
        !operation ||
        operation.source === "membership" ||
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
          !database
            .prepare("SELECT 1 FROM book_members WHERE book_id=? AND user_id=?")
            .get(bookId, split.memberId)
        )
          throw new HttpError(400, "AA 分摊须选择当前账本成员。");
    }
    const revision = access.book.revision + 1;
    const at = new Date(now()).toISOString();
    const operationId = randomUUID();
    database
      .prepare("UPDATE books SET ledger=?,revision=?,updated_at=? WHERE id=?")
      .run(JSON.stringify(next), revision, at, bookId);
    database
      .prepare("INSERT INTO book_operations VALUES(?,?,?,?,?,?,?,?)")
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
          database
            .prepare(
              "INSERT OR IGNORE INTO scheduler_runs(book_id,occurrence) VALUES(?,?)",
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
    database
      .prepare("INSERT INTO book_requests VALUES(?,?,?,?,?)")
      .run(bookId, userId, body.key, payload, JSON.stringify(result));
    return result;
  });
}
