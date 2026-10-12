import { randomBytes, randomUUID } from "node:crypto";
import { HttpError, json } from "./http.mjs";
import {
  membership,
  digest,
  transaction,
  auditMembership,
} from "./network-service.mjs";
export const OPEN_SCOPES = [
  "records:read",
  "records:write",
  "ai:recognize",
  "ai:confirm",
  "attachments:read",
  "attachments:write",
];
const isWrite = (scope) => !scope.endsWith(":read");
export async function requireOpenToken({ database, request, now }, scope) {
  if (
    request.headers.cookie !== undefined ||
    request.headers.origin !== undefined
  )
    throw new HttpError(
      403,
      "开放 API 仅接受专用令牌，不接受浏览器 Cookie 或 Origin。",
    );
  const value = request.headers.authorization;
  if (typeof value !== "string" || !/^Bearer hl_[A-Za-z0-9_-]{43}$/.test(value))
    throw new HttpError(401, "缺少有效的开放 API 令牌。");
  const token = await database
    .prepare("SELECT * FROM open_tokens WHERE token_hash=$1")
    .get(digest(value.slice(7)));
  if (!token || token.revoked_at !== null || token.expires_at <= now())
    throw new HttpError(401, "令牌已失效，请重新创建。", "invalid_token");
  const access = await membership(database, token.book_id, token.user_id);
  const scopes = JSON.parse(token.scopes);
  if (
    scope &&
    (!scopes.includes(scope) || (access.role === "viewer" && isWrite(scope)))
  )
    throw new HttpError(403, "令牌权限范围不足。", "insufficient_scope");
  return { ...token, scopes, access };
}
export async function limitOpenRequest(database, token, now) {
  const window = Math.floor(now() / 60000);
  const count = (
    await database
      .prepare(
        'INSERT INTO open_rate_limits(token_id,"window",hits) VALUES($1,$2,1)\n    ON CONFLICT(token_id) DO UPDATE SET "window"=excluded."window",hits=CASE WHEN open_rate_limits."window"=excluded."window" THEN open_rate_limits.hits+1 ELSE 1 END RETURNING hits',
      )
      .get(token.id, window)
  ).hits;
  if (count > 60)
    throw new HttpError(429, "每个令牌每分钟最多 60 次请求。", "rate_limited", {
      "Retry-After": String(Math.max(1, 60 - (Math.floor(now() / 1000) % 60))),
    });
}
export async function tokensApi(context) {
  const { database, path, request, response, userId, now, readBody } = context;
  const match = path.match(
    /^\/api\/network\/books\/([a-z0-9-]+)\/tokens(?:\/([a-z0-9-]+))?$/,
  );
  if (!match) return false;
  const bookId = match[1],
    tokenId = match[2];
  let access = await membership(database, bookId, userId);
  if (!tokenId && request.method === "GET") {
    const manager = ["owner", "admin"].includes(access.role);
    const tokens = (
      await database
        .prepare(
          'SELECT id,name,user_id AS "userId",scopes,expires_at AS "expiresAt",revoked_at AS "revokedAt",created_at AS "createdAt" FROM open_tokens WHERE book_id=$1 AND ($2 OR user_id=$3) ORDER BY created_at DESC',
        )
        .all(bookId, manager ? 1 : 0, userId)
    ).map((row) => ({ ...row, scopes: JSON.parse(row.scopes) }));
    json(response, 200, { tokens });
    return true;
  }
  if (!tokenId && request.method === "POST") {
    const body = await readBody();
    access = await membership(database, bookId, userId);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const scopes = body.scopes;
    const days = body.days ?? 30;
    if (
      !name ||
      name.length > 80 ||
      !Array.isArray(scopes) ||
      !scopes.length ||
      new Set(scopes).size !== scopes.length ||
      scopes.some((scope) => !OPEN_SCOPES.includes(scope)) ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365
    )
      throw new HttpError(400, "请填写令牌名称、有效权限及 1–365 天有效期。");
    if (access.role === "viewer" && scopes.some(isWrite))
      throw new HttpError(403, "只读成员只能创建读取令牌。");
    const id = randomUUID(),
      token = "hl_" + randomBytes(32).toString("base64url"),
      expiresAt = now() + days * 86400000;
    await transaction(database, async () => {
      access = await membership(database, bookId, userId);
      const count = (
        await database
          .prepare(
            "SELECT count(*) AS total FROM open_tokens WHERE book_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>$3",
          )
          .get(bookId, userId, now())
      ).total;
      if (count >= 20)
        throw new HttpError(
          409,
          "每个账本最多保留 20 个有效令牌，请先撤销旧令牌。",
        );
      await database
        .prepare("INSERT INTO open_tokens VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)")
        .run(
          id,
          bookId,
          userId,
          name,
          digest(token),
          JSON.stringify(scopes),
          expiresAt,
          null,
          new Date(now()).toISOString(),
        );
      await auditMembership(
        database,
        bookId,
        userId,
        `创建 API 令牌：${name}`,
        now,
        "token",
      );
    });
    json(response, 201, { id, token, expiresAt });
    return true;
  }
  if (tokenId && request.method === "DELETE") {
    await readBody();
    access = await membership(database, bookId, userId);
    const token = await database
      .prepare("SELECT * FROM open_tokens WHERE id=$1 AND book_id=$2")
      .get(tokenId, bookId);
    if (!token) throw new HttpError(404, "令牌不存在。");
    if (token.user_id !== userId && !["owner", "admin"].includes(access.role))
      throw new HttpError(403, "只能撤销自己的令牌。");
    await transaction(database, async () => {
      access = await membership(database, bookId, userId);
      if (token.user_id !== userId && !["owner", "admin"].includes(access.role))
        throw new HttpError(403, "只能撤销自己的令牌。");
      await database
        .prepare("UPDATE open_tokens SET revoked_at=$1 WHERE id=$2")
        .run(now(), tokenId);
      await auditMembership(
        database,
        bookId,
        userId,
        `撤销 API 令牌：${token.name}`,
        now,
        "token",
      );
    });
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}
