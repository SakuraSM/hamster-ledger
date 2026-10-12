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
export async function acceptInvite({ database, userId, body, now }) {
  return await transaction(database, async () => {
    let invitation = await database
      .prepare(
        "SELECT * FROM book_invites WHERE code_hash=$1 AND revoked_at IS NULL AND used_by IS NULL AND expires_at>$2",
      )
      .get(digest(String(body.code ?? "")), now());
    if (!invitation) throw new HttpError(400, "邀请码无效、已使用或已过期。");
    await database.lockBook(invitation.book_id);
    invitation = await database
      .prepare(
        "SELECT * FROM book_invites WHERE id=$1 AND revoked_at IS NULL AND used_by IS NULL AND expires_at>$2 FOR UPDATE",
      )
      .get(invitation.id, now());
    if (!invitation) throw new HttpError(400, "邀请码无效、已使用或已过期。");
    if (
      await database
        .prepare("SELECT 1 FROM book_members WHERE book_id=$1 AND user_id=$2")
        .get(invitation.book_id, userId)
    )
      throw new HttpError(409, "你已加入此账本。");
    await database
      .prepare("INSERT INTO book_members VALUES($1,$2,$3)")
      .run(invitation.book_id, userId, invitation.role);
    await database
      .prepare("UPDATE book_invites SET used_by=$1 WHERE id=$2")
      .run(userId, invitation.id);
    await auditMembership(
      database,
      invitation.book_id,
      userId,
      "通过邀请加入账本",
      now,
    );
    return { id: invitation.book_id };
  });
}
export async function memberRoute({
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
      members: await database
        .prepare(
          "SELECT m.user_id AS id,u.username,m.role FROM book_members m JOIN users u ON u.id=m.user_id WHERE m.book_id=$1 ORDER BY u.username",
        )
        .all(bookId),
    });
    return true;
  }
  if (rest === "/invites" && method === "GET") {
    requireManager(access);
    json(response, 200, {
      invites: await database
        .prepare(
          'SELECT id,role,expires_at AS "expiresAt",used_by AS "usedBy",revoked_at AS "revokedAt" FROM book_invites WHERE book_id=$1',
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
    await transaction(database, async () => {
      const current = await membership(database, bookId, access.userId);
      requireManager(current);
      if (body.role === "admin" && current.role !== "owner")
        throw new HttpError(403, "只有所有者能邀请管理员。");
      await database
        .prepare("INSERT INTO book_invites VALUES($1,$2,$3,$4,$5,NULL,NULL,$6)")
        .run(id, bookId, digest(code), body.role, expiresAt, access.userId);
      await auditMembership(
        database,
        bookId,
        access.userId,
        "创建成员邀请",
        now,
      );
    });
    json(response, 201, { id, code, expiresAt });
    return true;
  }
  const revoke = rest.match(/^\/invites\/([a-z0-9-]+)$/);
  if (revoke && method === "DELETE") {
    requireManager(access);
    await transaction(database, async () => {
      const current = await membership(database, bookId, access.userId);
      requireManager(current);
      if (body.role === "admin" && current.role !== "owner")
        throw new HttpError(403, "只有所有者能邀请管理员。");
      await database
        .prepare(
          "UPDATE book_invites SET revoked_at=$1 WHERE id=$2 AND book_id=$3",
        )
        .run(now(), revoke[1], bookId);
      await auditMembership(
        database,
        bookId,
        access.userId,
        "撤销成员邀请",
        now,
      );
    });
    json(response, 200, { ok: true });
    return true;
  }
  const member = rest.match(/^\/members\/([a-z0-9-]+)$/);
  if (member && ["PUT", "DELETE"].includes(method)) {
    await transaction(database, async () => {
      const current = await membership(database, bookId, access.userId);
      const target = await membership(database, bookId, member[1]);
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
        await database
          .prepare(
            "UPDATE book_members SET role=$1 WHERE book_id=$2 AND user_id=$3",
          )
          .run(body.role, bookId, member[1]);
      } else
        await database
          .prepare("DELETE FROM book_members WHERE book_id=$1 AND user_id=$2")
          .run(bookId, member[1]);
      await database
        .prepare(
          "UPDATE open_tokens SET revoked_at=$1 WHERE book_id=$2 AND user_id=$3",
        )
        .run(now(), bookId, member[1]);
      await database
        .prepare(
          "UPDATE book_invites SET revoked_at=$1 WHERE book_id=$2 AND created_by=$3 AND used_by IS NULL",
        )
        .run(now(), bookId, member[1]);
      await auditMembership(
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
    await transaction(database, async () => {
      requireManager(await membership(database, bookId, access.userId), true);
      const target = await membership(database, bookId, String(body.userId));
      if (target.userId === access.userId)
        throw new HttpError(400, "请选择另一位成员。");
      await database
        .prepare(
          "UPDATE book_members SET role='admin' WHERE book_id=$1 AND user_id=$2",
        )
        .run(bookId, access.userId);
      await database
        .prepare(
          "UPDATE book_members SET role='owner' WHERE book_id=$1 AND user_id=$2",
        )
        .run(bookId, target.userId);
      await database
        .prepare("UPDATE books SET user_id=$1 WHERE id=$2")
        .run(target.userId, bookId);
      await database
        .prepare(
          "UPDATE open_tokens SET revoked_at=$1 WHERE book_id=$2 AND user_id IN ($3,$4)",
        )
        .run(now(), bookId, access.userId, target.userId);
      await auditMembership(
        database,
        bookId,
        access.userId,
        "转移账本所有权",
        now,
      );
    });
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}
