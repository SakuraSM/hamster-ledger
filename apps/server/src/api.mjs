import { randomUUID } from "node:crypto";
import { ledgerSchema } from "@hamster-ledger/core";
import { createAuthApi } from "./auth.mjs";
import { requireSession } from "./sessions.mjs";
import { json, readJson, HttpError, verifyWriteOrigin } from "./http.mjs";
function parseBook(body) {
  const parsed = ledgerSchema.safeParse(body.ledger);
  if (!parsed.success) throw new HttpError(400, "账本格式不正确。");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40)
    throw new HttpError(400, "账本名称需为 1–40 个字符。");
  return { name, serialized: JSON.stringify(parsed.data) };
}
export function createApi({
  database,
  publicOrigin,
  allowRegistration = true,
  now = Date.now,
}) {
  const auth = createAuthApi({ database, allowRegistration, now });
  return async (request, response) => {
    const origin = publicOrigin ?? `http://${request.headers.host}`;
    const isSecure = origin.startsWith("https:");
    request.authCookieName = isSecure
      ? "__Host-hamster_session"
      : "hamster_session";
    verifyWriteOrigin(request, origin);
    const path = new URL(request.url, origin).pathname;
    const method = request.method;
    if (path === "/api/health" && method === "GET") {
      json(response, 200, { ok: true, storage: "sqlite" });
      return;
    }
    if (await auth(request, response, { path, isSecure })) return;
    const session = requireSession(request, database, {
      write: !["GET", "HEAD"].includes(method),
      now: now(),
    });
    const user = { id: session.user_id };
    if (path === "/api/books" && method === "GET") {
      json(response, 200, {
        books: database
          .prepare(
            "SELECT id,name,revision,updated_at AS updatedAt FROM books WHERE user_id=? ORDER BY updated_at DESC",
          )
          .all(user.id),
      });
      return;
    }
    if (path === "/api/books" && method === "POST") {
      const book = parseBook(await readJson(request));
      requireSession(request, database, { write: true, now: now() });
      const id = randomUUID();
      const updatedAt = new Date(now()).toISOString();
      database
        .prepare("INSERT INTO books VALUES(?,?,?,?,?,?)")
        .run(id, user.id, book.name, 1, book.serialized, updatedAt);
      json(response, 201, { id, name: book.name, revision: 1, updatedAt });
      return;
    }
    const match = path.match(/^\/api\/books\/([a-z0-9-]+)$/);
    if (match && ["GET", "PUT"].includes(method)) {
      const row = database
        .prepare("SELECT * FROM books WHERE id=? AND user_id=?")
        .get(match[1], user.id);
      if (!row) throw new HttpError(404, "云端账本不存在。");
      if (method === "GET") {
        json(response, 200, {
          id: row.id,
          name: row.name,
          revision: row.revision,
          updatedAt: row.updated_at,
          ledger: JSON.parse(row.ledger),
        });
        return;
      }
      const body = await readJson(request);
      const book = parseBook(body);
      requireSession(request, database, { write: true, now: now() });
      if (!Number.isSafeInteger(body.revision) || body.revision < 1)
        throw new HttpError(400, "缺少有效的账本版本。");
      const updatedAt = new Date(now()).toISOString();
      const result = database
        .prepare(
          "UPDATE books SET name=?,ledger=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?",
        )
        .run(
          book.name,
          book.serialized,
          updatedAt,
          row.id,
          user.id,
          body.revision,
        );
      if (result.changes === 0)
        throw new HttpError(409, "云端已有更新，请先保留或下载云端版本。");
      json(response, 200, {
        id: row.id,
        name: book.name,
        revision: body.revision + 1,
        updatedAt,
      });
      return;
    }
    throw new HttpError(404, "接口不存在。");
  };
}
