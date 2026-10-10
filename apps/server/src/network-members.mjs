import { randomBytes, randomUUID } from "node:crypto";
import {
  membership,
  requireManager,
  transaction,
  digest,
  auditMembership,
} from "./network-service.mjs";
import { json, HttpError } from "./http.mjs";
const INVITE_LIFETIME = 7 * 24 * 60 * 60 * 1000;
export function acceptInvite({ database, userId, body, now }) {
  return transaction(database, () => {
    const invitation = database
      .prepare(
        "SELECT * FROM book_invites WHERE code_hash=? AND revoked_at IS NULL AND used_by IS NULL AND expires_at>?",
      )
      .get(digest(String(body.code ?? "")), now());
    if (!invitation) throw new HttpError(400, "邀请码无效、已使用或已过期。");
    if (
      database
        .prepare("SELECT 1 FROM book_members WHERE book_id=? AND user_id=?")
        .get(invitation.book_id, userId)
    )
      throw new HttpError(409, "你已加入此账本。");
    database
      .prepare("INSERT INTO book_members VALUES(?,?,?)")
      .run(invitation.book_id, userId, invitation.role);
    database
      .prepare("UPDATE book_invites SET used_by=? WHERE id=?")
      .run(userId, invitation.id);
    auditMembership(
      database,
      invitation.book_id,
      userId,
      "通过邀请加入账本",
      now,
    );
    return { id: invitation.book_id };
  });
}
export function memberRoute({
  database,
  response,
  access,
  rest,
  method,
  body,
  now,
}) {
  const bookId = access.book.id;
  if (rest === "/members" && method === "GET") {
    json(response, 200, {
      members: database
        .prepare(
          "SELECT m.user_id AS id,u.username,m.role FROM book_members m JOIN users u ON u.id=m.user_id WHERE m.book_id=? ORDER BY u.username",
        )
        .all(bookId),
    });
    return true;
  }
  if (rest === "/invites" && method === "GET") {
    requireManager(access);
    json(response, 200, {
      invites: database
        .prepare(
          "SELECT id,role,expires_at AS expiresAt,used_by AS usedBy,revoked_at AS revokedAt FROM book_invites WHERE book_id=?",
        )
        .all(bookId),
    });
    return true;
  }
  if (rest === "/invites" && method === "POST") {
    requireManager(access);
    if (
      ![
        "member",
        "viewer",
        ...(access.role === "owner" ? ["admin"] : []),
      ].includes(body.role)
    )
      throw new HttpError(400, "邀请角色无效。");
    const code = randomBytes(24).toString("base64url"),
      id = randomUUID(),
      expiresAt = now() + INVITE_LIFETIME;
    transaction(database, () => {
      database
        .prepare("INSERT INTO book_invites VALUES(?,?,?,?,?,NULL,NULL,?)")
        .run(id, bookId, digest(code), body.role, expiresAt, access.userId);
      auditMembership(database, bookId, access.userId, "创建成员邀请", now);
    });
    json(response, 201, { id, code, expiresAt });
    return true;
  }
  const revoke = rest.match(/^\/invites\/([a-z0-9-]+)$/);
  if (revoke && method === "DELETE") {
    requireManager(access);
    transaction(database, () => {
      database
        .prepare(
          "UPDATE book_invites SET revoked_at=? WHERE id=? AND book_id=?",
        )
        .run(now(), revoke[1], bookId);
      auditMembership(database, bookId, access.userId, "撤销成员邀请", now);
    });
    json(response, 200, { ok: true });
    return true;
  }
  const member = rest.match(/^\/members\/([a-z0-9-]+)$/);
  if (member && ["PUT", "DELETE"].includes(method)) {
    transaction(database, () => {
      const current = membership(database, bookId, access.userId);
      const target = membership(database, bookId, member[1]);
      const leaving = method === "DELETE" && member[1] === access.userId;
      if (!leaving) requireManager(current);
      if (target.role === "owner")
        throw new HttpError(400, "所有者须先转移账本所有权。");
      if (!leaving && current.role !== "owner" && target.role === "admin")
        throw new HttpError(403, "只有所有者能管理管理员。");
      if (method === "PUT") {
        if (
          ![
            "viewer",
            "member",
            ...(current.role === "owner" ? ["admin"] : []),
          ].includes(body.role)
        )
          throw new HttpError(400, "角色无效。");
        database
          .prepare(
            "UPDATE book_members SET role=? WHERE book_id=? AND user_id=?",
          )
          .run(body.role, bookId, member[1]);
      } else
        database
          .prepare("DELETE FROM book_members WHERE book_id=? AND user_id=?")
          .run(bookId, member[1]);
      database
        .prepare(
          "UPDATE open_tokens SET revoked_at=? WHERE book_id=? AND user_id=?",
        )
        .run(now(), bookId, member[1]);
      database
        .prepare(
          "UPDATE book_invites SET revoked_at=? WHERE book_id=? AND created_by=? AND used_by IS NULL",
        )
        .run(now(), bookId, member[1]);
      auditMembership(
        database,
        bookId,
        access.userId,
        method === "PUT"
          ? `修改成员角色为 ${body.role}`
          : leaving
            ? "退出账本"
            : "移除成员",
        now,
      );
    });
    json(response, 200, { ok: true });
    return true;
  }
  if (rest === "/owner" && method === "PUT") {
    transaction(database, () => {
      requireManager(membership(database, bookId, access.userId), true);
      const target = membership(database, bookId, String(body.userId));
      if (target.userId === access.userId)
        throw new HttpError(400, "请选择另一位成员。");
      database
        .prepare(
          "UPDATE book_members SET role='admin' WHERE book_id=? AND user_id=?",
        )
        .run(bookId, access.userId);
      database
        .prepare(
          "UPDATE book_members SET role='owner' WHERE book_id=? AND user_id=?",
        )
        .run(bookId, target.userId);
      database
        .prepare("UPDATE books SET user_id=? WHERE id=?")
        .run(target.userId, bookId);
      database
        .prepare(
          "UPDATE open_tokens SET revoked_at=? WHERE book_id=? AND user_id IN (?,?)",
        )
        .run(now(), bookId, access.userId, target.userId);
      auditMembership(database, bookId, access.userId, "转移账本所有权", now);
    });
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}
