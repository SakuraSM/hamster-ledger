import { createHash, randomUUID } from "node:crypto";
import { HttpError, json } from "./http.mjs";
import { membership } from "./network-service.mjs";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export function parseAttachment(input) {
  if (
    !input ||
    typeof input.base64 !== "string" ||
    input.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      input.base64,
    )
  )
    throw new HttpError(400, "附件编码或大小无效（最大 8 MiB）。");
  const bytes = Buffer.from(input.base64, "base64");
  const mime = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString())
        ? "image/gif"
        : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
  if (!mime || mime !== input.mime || bytes.length < 12)
    throw new HttpError(400, "只接受内容匹配的 PNG、JPEG、GIF 或 WebP 图片。");
  const name =
    typeof input.name === "string"
      ? input.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180)
      : "凭证图片";
  return {
    bytes,
    mime,
    name,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
export function referencedAttachmentIds(ledger) {
  return new Set([
    ...ledger.records.flatMap((record) => record.detail?.attachmentIds ?? []),
    ...(ledger.aiDrafts ?? [])
      .filter((draft) => draft.state === "pending")
      .flatMap((draft) => draft.attachmentIds),
  ]);
}
export async function getAttachment(database, id, userId, bookId) {
  if (bookId) await membership(database, bookId, userId);
  const row = await database
    .prepare("SELECT * FROM attachments WHERE id=$1")
    .get(id);
  if (
    !row ||
    (bookId
      ? row.book_id !== bookId
      : row.book_id !== null || row.user_id !== userId)
  )
    throw new HttpError(404, "附件不存在或无权访问。");
  return row;
}
export function attachmentJson(row) {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    hash: row.hash,
    base64: Buffer.from(row.bytes).toString("base64"),
    createdAt: row.created_at,
  };
}
export async function storeAttachment({
  database,
  userId,
  bookId = null,
  body,
  now,
}) {
  return database.transaction(async () => {
    if (!bookId)
      await database.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "attachment:" + userId,
      ]);
    if (
      bookId &&
      (await membership(database, bookId, userId)).role === "viewer"
    )
      throw new HttpError(403, "只读成员不能上传。");
    const image = parseAttachment(body);
    if (
      body.id !== undefined &&
      (typeof body.id !== "string" || !/^[a-zA-Z0-9:_-]{8,160}$/.test(body.id))
    )
      throw new HttpError(400, "附件 ID 无效。");
    const identified = body.id
      ? await database
          .prepare("SELECT * FROM attachments WHERE id=$1")
          .get(body.id)
      : null;
    if (identified) {
      if (
        identified.book_id !== bookId ||
        (!bookId && identified.user_id !== userId) ||
        identified.hash !== image.hash
      )
        throw new HttpError(409, "附件 ID 已存在且内容或归属不匹配。");
      return attachmentJson(identified);
    }
    const found =
      !body.id &&
      (await database
        .prepare(
          "SELECT * FROM attachments WHERE book_id IS NOT DISTINCT FROM $1 AND user_id=$2 AND hash=$3",
        )
        .get(bookId, userId, image.hash));
    if (found) return attachmentJson(found);
    const size = (
      await database
        .prepare(
          "SELECT COALESCE(SUM(length(bytes)),0) AS total FROM attachments WHERE user_id=$1",
        )
        .get(userId)
    ).total;
    if (size + image.bytes.length > 100 * 1024 * 1024)
      throw new HttpError(413, "附件空间已达 100 MiB，请清理未使用的附件。");
    const id = body.id ?? randomUUID();
    const at = now();
    await database
      .prepare("INSERT INTO attachments VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
      .run(
        id,
        bookId,
        userId,
        image.mime,
        image.name,
        image.hash,
        image.bytes,
        at,
      );
    return {
      id,
      name: image.name,
      mime: image.mime,
      hash: image.hash,
      createdAt: at,
    };
  });
}
export async function attachmentsApi(context) {
  const { database, path, request, response, userId, now, readBody } = context;
  const match = path.match(
    /^\/api\/(?:network\/books\/([a-z0-9-]+)\/)?attachments(?:\/([a-z0-9-]+|cleanup))?$/,
  );
  if (!match) return false;
  const bookId = match[1] ?? null,
    id = match[2];
  if (bookId) await membership(database, bookId, userId);
  if (!id && request.method === "POST") {
    const body = await readBody();
    json(
      response,
      201,
      await storeAttachment({ database, userId, bookId, body, now }),
    );
    return true;
  }
  if (!id && request.method === "GET") {
    const rows = await database
      .prepare(
        'SELECT id,name,mime,hash,created_at AS "createdAt",length(bytes) AS size,user_id AS "userId" FROM attachments WHERE book_id IS NOT DISTINCT FROM $1 AND ($2 IS NOT NULL OR user_id=$3)',
      )
      .all(bookId, bookId, userId);
    json(response, 200, { attachments: rows });
    return true;
  }
  if (id === "cleanup" && request.method === "POST") {
    await readBody();
    const removed = await database.transaction(async () => {
      const latest = bookId ? await membership(database, bookId, userId) : null;
      if (latest?.role === "viewer")
        throw new HttpError(403, "只读成员不能清理附件。");
      const refs = latest
        ? referencedAttachmentIds(JSON.parse(latest.book.ledger))
        : new Set();
      const rows = await database
        .prepare(
          "SELECT id,created_at FROM attachments WHERE book_id IS NOT DISTINCT FROM $1 AND user_id=$2",
        )
        .all(bookId, userId);
      let removed = 0;
      for (const row of rows)
        if (!refs.has(row.id) && row.created_at < now() - 24 * 60 * 60 * 1000)
          removed += (
            await database
              .prepare("DELETE FROM attachments WHERE id=$1")
              .run(row.id)
          ).rowCount;
      return removed;
    });
    json(response, 200, { removed });
    return true;
  }
  if (id && request.method === "GET") {
    json(
      response,
      200,
      attachmentJson(await getAttachment(database, id, userId, bookId)),
    );
    return true;
  }
  if (id && request.method === "DELETE") {
    await readBody();
    await database.transaction(async () => {
      const row = await getAttachment(database, id, userId, bookId);
      const access = bookId ? await membership(database, bookId, userId) : null;
      if (
        access?.role === "viewer" ||
        (row.user_id !== userId && !["owner", "admin"].includes(access?.role))
      )
        throw new HttpError(403, "不能删除其他成员的附件。");
      if (
        bookId &&
        referencedAttachmentIds(
          JSON.parse((await membership(database, bookId, userId)).book.ledger),
        ).has(id)
      )
        throw new HttpError(409, "附件仍被流水或待确认草稿引用。");
      await database.prepare("DELETE FROM attachments WHERE id=$1").run(id);
    });
    json(response, 200, { ok: true });
    return true;
  }
  return false;
}
