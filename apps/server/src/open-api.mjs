import { randomUUID } from "node:crypto";
import { saveAdvancedEntry, ledgerPatch } from "@hamster-ledger/core";
import { HttpError, json, readJson } from "./http.mjs";
import {
  snapshot,
  membership,
  digest,
  applyOperation,
  transaction,
  auditMembership,
} from "./network-service.mjs";
import { requireOpenToken, limitOpenRequest } from "./open-tokens.mjs";
import { recognizeAi, confirmNetworkDraft } from "./ai-api.mjs";
import {
  storeAttachment,
  getAttachment,
  attachmentJson,
} from "./attachments.mjs";
const ROUTES = {
  "GET /ping": null,
  "GET /context": "records:read",
  "GET /records": "records:read",
  "POST /records": "records:write",
  "POST /ai/recognize": "ai:recognize",
  "POST /ai/confirm": "ai:confirm",
  "POST /attachments": "attachments:write",
};
function bookContext(context, token) {
  const current = snapshot(
    membership(context.database, token.book_id, token.user_id),
  );
  return {
    bookId: current.id,
    revision: current.revision,
    accounts: current.ledger.accounts,
    categories: current.ledger.categories,
  };
}
function listRecords(context, token, url) {
  const current = snapshot(
    membership(context.database, token.book_id, token.user_id),
  );
  const limit = Number(url.searchParams.get("limit") ?? 50),
    offset = Number(url.searchParams.get("offset") ?? 0);
  const from = url.searchParams.get("from"),
    to = url.searchParams.get("to");
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    [from, to].some((date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
  )
    throw new HttpError(400, "查询日期或分页无效。");
  if (
    url.searchParams.has("revision") &&
    Number(url.searchParams.get("revision")) !== current.revision
  )
    throw new HttpError(
      409,
      "分页期间账本已更新，请从第一页重新查询。",
      "revision_conflict",
    );
  const records = current.ledger.records
    .filter(
      (record) =>
        !record.isDeleted &&
        record.status === "confirmed" &&
        (!from || record.date.slice(0, 10) >= from) &&
        (!to || record.date.slice(0, 10) <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return {
    bookId: current.id,
    revision: current.revision,
    total: records.length,
    records: records.slice(offset, offset + limit),
    nextOffset: offset + limit < records.length ? offset + limit : null,
  };
}
function createRecord(context, token, body) {
  const current = snapshot(
    membership(context.database, token.book_id, token.user_id),
  );
  const id = "api:" + randomUUID();
  let next;
  try {
    next = saveAdvancedEntry(current.ledger, {
      ...body.entry,
      id,
      expectedRecord: undefined,
      detail: { ...body.entry?.detail, origin: "api", memberId: token.user_id },
    });
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  const result = applyOperation({
    ...context,
    bookId: token.book_id,
    source: "open-api",
    body: {
      key: body.key,
      revision: body.revision,
      patch: ledgerPatch(current.ledger, next),
    },
    command: { type: "open-create", tokenId: token.id, entry: body.entry },
  });
  return {
    revision: result.revision,
    operationId: result.operationId,
    record: result.ledger.records.find((item) => item.id === id),
  };
}
export async function openApi(context) {
  const { database, request, response, now } = context;
  const url = new URL(request.url, "http://localhost"),
    path = url.pathname.slice("/api/open/v1".length);
  const attachment = path.match(/^\/attachments\/([A-Za-z0-9:_-]{8,160})$/);
  const route = `${request.method} ${path}`;
  const scope =
    attachment && request.method === "GET" ? "attachments:read" : ROUTES[route];
  const token = requireOpenToken(context, scope);
  limitOpenRequest(database, token, now);
  if (scope === undefined) throw new HttpError(404, "开放 API 接口不存在。");
  const revalidate = () => requireOpenToken(context, scope);
  const scoped = {
    ...context,
    userId: token.user_id,
    source: "open-api",
    forceDrafts: !token.scopes.includes("records:write"),
    revalidate,
  };
  if (request.method === "GET") {
    const result =
      path === "/ping"
        ? {
            ok: true,
            version: "v1",
            bookId: token.book_id,
            revision: token.access.book.revision,
            role: token.access.role,
            scopes: token.scopes,
          }
        : path === "/context"
          ? bookContext(context, token)
          : path === "/records"
            ? listRecords(context, token, url)
            : attachmentJson(
                getAttachment(
                  database,
                  attachment[1],
                  token.user_id,
                  token.book_id,
                ),
              );
    json(response, 200, result);
    return;
  }
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[A-Za-z0-9:_-]{8,100}$/.test(key))
    throw new HttpError(
      400,
      "写入请求需要 8–100 字符的 Idempotency-Key。",
      "idempotency_required",
    );
  const raw = await readJson(request);
  revalidate();
  const requestDigest = digest({ route, body: raw });
  const previous = database
    .prepare("SELECT * FROM open_requests WHERE token_id=? AND request_key=?")
    .get(token.id, key);
  if (previous) {
    if (previous.digest !== requestDigest)
      throw new HttpError(409, "幂等键已用于另一项请求。");
    json(response, previous.status, JSON.parse(previous.result), {
      "Idempotency-Replayed": "true",
    });
    return;
  }
  const body = { ...raw, key: `open:${token.id}:${key}` };
  let result,
    status = 200;
  // Ledger operations keep a durable receipt for crash recovery. Attachment
  // uploads commit their response receipt and audit in the same transaction.
  if (path === "/records") {
    const persisted = database
      .prepare(
        "SELECT digest,result FROM book_requests WHERE book_id=? AND user_id=? AND request_key=?",
      )
      .get(token.book_id, token.user_id, body.key);
    if (persisted) {
      if (
        persisted.digest !==
        digest({
          command: {
            type: "open-create",
            tokenId: token.id,
            entry: body.entry,
          },
        })
      )
        throw new HttpError(409, "幂等键已用于另一项操作。");
      const saved = JSON.parse(persisted.result);
      const operation = database
        .prepare("SELECT before_json FROM book_operations WHERE id=?")
        .get(saved.operationId);
      const beforeIds = new Set(
        JSON.parse(operation.before_json).records.map((record) => record.id),
      );
      result = {
        revision: saved.revision,
        operationId: saved.operationId,
        record: saved.ledger.records.find(
          (record) => !beforeIds.has(record.id),
        ),
      };
    } else result = createRecord(scoped, token, body);
    status = 201;
  } else if (path === "/ai/recognize") {
    const saved = await recognizeAi(scoped, token.book_id, body);
    result = {
      revision: saved.revision,
      operationId: saved.operationId,
      drafts: saved.drafts,
    };
  } else if (path === "/ai/confirm") {
    const saved = confirmNetworkDraft(scoped, token.book_id, body);
    const draft = saved.ledger.aiDrafts.find(
      (item) => item.id === body.draftId,
    );
    result = {
      revision: saved.revision,
      operationId: saved.operationId,
      record: saved.ledger.records.find(
        (record) => record.id === draft?.recordId,
      ),
    };
  } else if (path === "/attachments") {
    status = 201;
    transaction(database, () => {
      const stored = storeAttachment({
        ...scoped,
        bookId: token.book_id,
        body,
        now,
      });
      const { base64: _bytes, ...metadata } = stored;
      result = metadata;
      auditMembership(
        database,
        token.book_id,
        token.user_id,
        "通过 API 上传附件",
        now,
        "open-api",
      );
      database
        .prepare("INSERT INTO open_requests VALUES(?,?,?,?,?,?)")
        .run(
          token.id,
          key,
          requestDigest,
          status,
          JSON.stringify(result),
          now(),
        );
    });
    json(response, status, result);
    return;
  }
  revalidate();
  database
    .prepare("INSERT OR IGNORE INTO open_requests VALUES(?,?,?,?,?,?)")
    .run(token.id, key, requestDigest, status, JSON.stringify(result), now());
  json(response, status, result);
}
