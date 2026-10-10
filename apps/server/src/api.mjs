import { openApi } from "./open-api.mjs";
import { tokensApi } from "./open-tokens.mjs";
import { modelsApi } from "./models.mjs";
import { attachmentsApi } from "./attachments.mjs";
import { aiApi } from "./ai-api.mjs";
import { randomUUID } from "node:crypto";
import { ledgerSchema } from "@hamster-ledger/core";
import { createAuthApi } from "./auth.mjs";
import { requireSession } from "./sessions.mjs";
import { json, readJson, HttpError, verifyWriteOrigin } from "./http.mjs";
import { networkApi } from "./network-api.mjs";
import { exchangeApi } from "./exchange-api.mjs";
function parseBook(body) {
  const parsed = ledgerSchema.safeParse(body.ledger);
  if (!parsed.success) throw new HttpError(400, "账本格式不正确。");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 40)
    throw new HttpError(400, "账本名称需为 1–40 个字符。");
  return { name, serialized: JSON.stringify(parsed.data) };
}
function requireSnapshotBook(database, bookId, userId) {
  const row = database
    .prepare("SELECT * FROM books WHERE id=? AND user_id=?")
    .get(bookId, userId);
  if (!row) throw new HttpError(404, "云端账本不存在。");
  if (row.authority === "server")
    throw new HttpError(
      426,
      "此账本已启用联网编辑，请升级客户端并从联网账本打开。",
      "network_book_required",
    );
  return row;
}
export function createApi({
  database,
  publicOrigin,
  allowRegistration = true,
  now = Date.now,
  modelTransport,
  secrets,
}) {
  const auth = createAuthApi({ database, allowRegistration, now });
  return async (request, response) => {
    const origin = publicOrigin ?? `http://${request.headers.host}`;
    const isSecure = origin.startsWith("https:");
    request.authCookieName = isSecure
      ? "__Host-hamster_session"
      : "hamster_session";
    const requestedPath = new URL(request.url, origin).pathname;
    if (requestedPath.startsWith("/api/open/")) {
      if (!requestedPath.startsWith("/api/open/v1/"))
        throw new HttpError(404, "开放 API 版本不存在。");
      await openApi({
        database,
        request,
        response,
        now,
        modelTransport,
        secrets,
      });
      return;
    }
    request.authTransport = requestedPath.startsWith("/api/native/")
      ? "native"
      : "cookie";
    if (request.authTransport === "native") {
      // Native endpoints never accept ambient browser credentials or browser origins.
      if (
        request.headers.origin !== undefined ||
        request.headers.cookie !== undefined
      )
        throw new HttpError(403, "此接口仅接受原生客户端的独立凭据。");
      if (
        !["GET", "HEAD"].includes(request.method) &&
        !request.headers["content-type"]?.startsWith("application/json")
      )
        throw new HttpError(415, "请求必须使用 JSON。");
    } else verifyWriteOrigin(request, origin);
    const path =
      request.authTransport === "native"
        ? requestedPath.replace("/api/native/", "/api/")
        : requestedPath;
    const method = request.method;
    if (path === "/api/health" && method === "GET") {
      json(response, 200, { ok: true, storage: "sqlite" });
      return;
    }
    if (await auth(request, response, { path, isSecure })) return;
    if (await exchangeApi({ database, request, response, now })) return;
    const session = requireSession(request, database, {
      write: !["GET", "HEAD"].includes(method),
      now: now(),
    });
    const user = { id: session.user_id };
    if (path === "/api/capabilities" && method === "GET") {
      json(response, 200, {
        ledgerVersions: [1, 2],
        networkBooks: true,
        openApiVersions: ["v1"],
      });
      return;
    }
    const context = {
      database,
      request,
      response,
      path,
      userId: user.id,
      now,
      modelTransport,
      secrets,
      revalidate: () =>
        requireSession(request, database, { write: true, now: now() }),
      readBody: async () => {
        const body = await readJson(request);
        requireSession(request, database, { write: true, now: now() });
        return body;
      },
    };
    if (
      (await tokensApi(context)) ||
      (await modelsApi(context)) ||
      (await attachmentsApi(context)) ||
      (await aiApi(context))
    )
      return;
    if (
      await networkApi({
        database,
        request,
        response,
        path,
        userId: user.id,
        now,
        readBody: async () => {
          const body = await readJson(request);
          requireSession(request, database, { write: true, now: now() });
          return body;
        },
      })
    )
      return;
    if (path === "/api/books" && method === "GET") {
      json(response, 200, {
        books: database
          .prepare(
            "SELECT id,name,revision,updated_at AS updatedAt FROM books WHERE user_id=? AND authority='snapshot' ORDER BY updated_at DESC",
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
        .prepare(
          "INSERT INTO books(id,user_id,name,revision,ledger,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .run(id, user.id, book.name, 1, book.serialized, updatedAt);
      json(response, 201, { id, name: book.name, revision: 1, updatedAt });
      return;
    }
    const match = path.match(/^\/api\/books\/([a-z0-9-]+)$/);
    if (match && ["GET", "PUT"].includes(method)) {
      let row = requireSnapshotBook(database, match[1], user.id);
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
      row = requireSnapshotBook(database, match[1], user.id);
      if (JSON.parse(row.ledger).version === 2 && body.ledger?.version !== 2)
        throw new HttpError(
          426,
          "账本已升级，请更新客户端后再写入。",
          "upgrade_required",
        );
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
