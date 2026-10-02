import { randomUUID } from "node:crypto";
import { ledgerSchema } from "@hamster-ledger/core";
import { authenticate, getSession, requireSession, logout } from "./auth.mjs";
import {
  json,
  readJson,
  HttpError,
  verifyWriteOrigin,
  createLimiter,
} from "./http.mjs";
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
}) {
  const limit = createLimiter();
  return async (request, response) => {
    const origin = publicOrigin ?? `http://${request.headers.host}`;
    const isSecure = origin.startsWith("https:");
    verifyWriteOrigin(request, origin);
    const path = new URL(request.url, origin).pathname;
    const method = request.method;
    if (path === "/api/health" && method === "GET") {
      json(response, 200, { ok: true, storage: "sqlite" });
      return;
    }
    if (path === "/api/auth/me" && method === "GET") {
      json(response, 200, { user: getSession(request, database) });
      return;
    }
    if (
      ["/api/auth/register", "/api/auth/login"].includes(path) &&
      method === "POST"
    ) {
      limit(request);
      const isRegister = path.endsWith("register");
      if (isRegister && !allowRegistration)
        throw new HttpError(403, "此服务已关闭注册。");
      const result = await authenticate({
        database,
        body: await readJson(request),
        isRegister,
        isSecure,
      });
      json(
        response,
        isRegister ? 201 : 200,
        { user: result.user },
        { "Set-Cookie": result.cookie },
      );
      return;
    }
    if (path === "/api/auth/logout" && method === "POST") {
      json(
        response,
        200,
        { ok: true },
        { "Set-Cookie": logout(request, database, isSecure) },
      );
      return;
    }
    const user = requireSession(request, database);
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
      const id = randomUUID();
      const now = new Date().toISOString();
      database
        .prepare("INSERT INTO books VALUES(?,?,?,?,?,?)")
        .run(id, user.id, book.name, 1, book.serialized, now);
      json(response, 201, { id, name: book.name, revision: 1, updatedAt: now });
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
      if (!Number.isSafeInteger(body.revision) || body.revision < 1)
        throw new HttpError(400, "缺少有效的账本版本。");
      const now = new Date().toISOString();
      const result = database
        .prepare(
          "UPDATE books SET name=?,ledger=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?",
        )
        .run(book.name, book.serialized, now, row.id, user.id, body.revision);
      if (result.changes === 0)
        throw new HttpError(409, "云端已有更新，请先保留或下载云端版本。");
      json(response, 200, {
        id: row.id,
        name: book.name,
        revision: body.revision + 1,
        updatedAt: now,
      });
      return;
    }
    throw new HttpError(404, "接口不存在。");
  };
}
