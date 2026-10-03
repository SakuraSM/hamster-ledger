import { randomUUID } from "node:crypto";
import { migrateLedger } from "@hamster-ledger/core";
import { json, HttpError } from "./http.mjs";
import {
  membership,
  snapshot,
  transaction,
  digest,
  requireManager,
  applyOperation,
} from "./network-service.mjs";
import { memberRoute, acceptInvite } from "./network-members.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function convertBook({ database, userId, body, now }) {
  return transaction(database, () => {
    if (body.confirm !== true)
      throw new HttpError(400, "请确认联网账本将使用在线编辑。");
    let ledger;
    try {
      ledger = migrateLedger(body.ledger);
    } catch {
      throw new HttpError(400, "账本内容无效。");
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 40)
      throw new HttpError(400, "请填写 1–40 字账本名称。");
    const at = new Date(now()).toISOString();
    let id = randomUUID(),
      revision = 1;
    if (body.sourceBookId) {
      const previous = database
        .prepare("SELECT * FROM books WHERE id=? AND user_id=?")
        .get(body.sourceBookId, userId);
      if (!previous || previous.authority !== "snapshot")
        throw new HttpError(409, "原同步账本不存在或已转换。");
      if (
        previous.revision !== body.revision ||
        digest(canonical(migrateLedger(JSON.parse(previous.ledger)))) !==
          digest(canonical(ledger))
      )
        throw new HttpError(
          409,
          "本地与云端尚未一致，不能转换。",
          "revision_conflict",
        );
      id = previous.id;
      revision = previous.revision + 1;
      database
        .prepare("INSERT INTO book_backups VALUES(?,?,?,?,?)")
        .run(randomUUID(), id, previous.ledger, previous.revision, at);
    }
    ledger.records = ledger.records.map((record) => ({
      ...record,
      detail: record.detail
        ? { ...record.detail, memberId: userId }
        : record.detail,
    }));
    if (body.sourceBookId)
      database
        .prepare(
          "UPDATE books SET name=?,ledger=?,revision=?,updated_at=?,authority='server' WHERE id=?",
        )
        .run(name, JSON.stringify(ledger), revision, at, id);
    else {
      database
        .prepare(
          "INSERT INTO books(id,user_id,name,revision,ledger,updated_at,authority) VALUES(?,?,?,?,?,?,'server')",
        )
        .run(id, userId, name, revision, JSON.stringify(ledger), at);
      database
        .prepare("INSERT INTO book_backups VALUES(?,?,?,?,?)")
        .run(randomUUID(), id, JSON.stringify(body.ledger), 0, at);
    }
    database
      .prepare("INSERT INTO book_members VALUES(?,?,'owner')")
      .run(id, userId);
    return snapshot(membership(database, id, userId));
  });
}
export async function networkApi({
  database,
  request,
  response,
  path,
  userId,
  readBody,
  now,
}) {
  if (!path.startsWith("/api/network/")) return false;
  const method = request.method;
  const body = ["GET", "HEAD"].includes(method) ? {} : await readBody();
  if (path === "/api/network/books" && method === "GET") {
    json(response, 200, {
      books: database
        .prepare(
          "SELECT b.id,b.name,b.revision,b.updated_at AS updatedAt,m.role FROM books b JOIN book_members m ON m.book_id=b.id WHERE m.user_id=? AND b.authority='server' ORDER BY b.updated_at DESC",
        )
        .all(userId),
    });
    return true;
  }
  if (path === "/api/network/books" && method === "POST") {
    json(response, 201, convertBook({ database, userId, body, now }));
    return true;
  }
  if (path === "/api/network/invites/accept" && method === "POST") {
    json(response, 200, acceptInvite({ database, userId, body, now }));
    return true;
  }
  const match = path.match(/^\/api\/network\/books\/([a-z0-9-]+)(.*)$/);
  if (!match) throw new HttpError(404, "联网账本接口不存在。");
  const access = membership(database, match[1], userId),
    rest = match[2];
  if (!rest && method === "GET") {
    json(response, 200, snapshot(access));
    return true;
  }
  if (!rest && method === "DELETE") {
    requireManager(access, true);
    if (body.confirm !== true) throw new HttpError(400, "请确认删除联网账本。");
    database.prepare("DELETE FROM books WHERE id=?").run(access.book.id);
    json(response, 200, { ok: true });
    return true;
  }
  if (rest === "/operations" && method === "POST") {
    json(
      response,
      200,
      applyOperation({ database, bookId: match[1], userId, body, now }),
    );
    return true;
  }
  if (rest === "/history" && method === "GET") {
    json(response, 200, {
      history: database
        .prepare(
          "SELECT o.id,o.user_id AS userId,u.username,o.source,o.summary,o.revision,o.created_at AS createdAt FROM book_operations o JOIN users u ON u.id=o.user_id WHERE o.book_id=? ORDER BY o.created_at DESC,o.rowid DESC LIMIT 100",
        )
        .all(match[1]),
    });
    return true;
  }
  if (rest === "/backup" && method === "GET") {
    requireManager(access);
    const backup = database
      .prepare(
        "SELECT ledger,revision,created_at AS createdAt FROM book_backups WHERE book_id=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(match[1]);
    json(
      response,
      200,
      backup
        ? { ...backup, ledger: JSON.parse(backup.ledger) }
        : { ledger: snapshot(access).ledger },
    );
    return true;
  }
  if (memberRoute({ database, response, access, rest, method, body, now }))
    return true;
  throw new HttpError(404, "联网账本接口不存在。");
}
