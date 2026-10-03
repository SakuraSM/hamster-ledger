import { randomUUID } from "node:crypto";
import {
  EMPTY_LEDGER,
  ledgerSchema,
  categoryNames,
  addAiDrafts,
  parseRuleText,
  confirmAiDraft,
  ledgerPatch,
} from "@hamster-ledger/core";
import { HttpError, json } from "./http.mjs";
import {
  membership,
  snapshot,
  digest,
  requireManager,
  applyOperation,
  auditMembership,
} from "./network-service.mjs";
import { getAttachment, attachmentJson } from "./attachments.mjs";
import {
  readModelProfile,
  modelCredentials,
  extractWithModel,
} from "./models.mjs";
const manager = (access) => {
  if (access.role === "viewer")
    throw new HttpError(403, "只读成员不能识别或确认草稿。");
};
function payload(body) {
  if (typeof body.key !== "string" || !/^[A-Za-z0-9:_-]{8,160}$/.test(body.key))
    throw new HttpError(400, "缺少有效的识别幂等键。");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const ids = body.attachmentIds ?? [];
  if (
    text.length > 20000 ||
    !Array.isArray(ids) ||
    ids.length > 5 ||
    ids.some((id) => typeof id !== "string") ||
    (!text && !ids.length)
  )
    throw new HttpError(400, "请输入文本或选择最多 5 张图片。");
  return { text, ids };
}
export async function recognizeAi(context, bookId, body) {
  const {
    database,
    userId,
    now,
    modelTransport,
    revalidate = () => {},
  } = context;
  const { text, ids } = payload(body);
  let access = bookId ? membership(database, bookId, userId) : null;
  if (access) manager(access);
  let ledger;
  try {
    ledger = access
      ? snapshot(access).ledger
      : ledgerSchema.parse({
          ...EMPTY_LEDGER,
          accounts: body.context?.accounts ?? [],
          categories: body.context?.categories ?? [],
        });
  } catch {
    throw new HttpError(400, "账户或分类上下文无效。");
  }
  const images = ids.map((id) =>
    attachmentJson(getAttachment(database, id, userId, bookId)),
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now()));
  const sourceHash = digest({
    text,
    images: images.map((image) => image.hash).sort(),
    ...(!images.length ? { today } : {}),
  });
  const existing =
    ledger.aiDrafts?.filter((draft) => draft.sourceHash === sourceHash) ?? [];
  if (existing.length)
    return { ...snapshot(access), drafts: existing, reused: true };
  const profile = readModelProfile(database, userId);
  if (images.length && !profile)
    throw new HttpError(
      400,
      "未配置模型，图片识别不可用；仍可使用本地文本解析。",
    );
  if (images.length && body.targetEndpoint !== profile?.config.endpoint)
    throw new HttpError(409, "图片发送目标已变更，请核对服务地址后重试。");
  const candidates = profile
    ? await extractWithModel({
        credentials: modelCredentials(context),
        transport: modelTransport,
        text,
        images,
        accounts: ledger.accounts
          .filter((account) => !account.isArchived)
          .map(({ id, name, currency }) => ({
            id,
            name,
            currency: currency ?? "CNY",
          })),
        categories: categoryNames(ledger),
        today,
      })
    : parseRuleText(text, ledger, today);
  revalidate();
  const drafts = candidates.map((candidate) => ({
    id: randomUUID(),
    sourceHash,
    source: images.length
      ? "model-image"
      : profile
        ? "model-text"
        : "text-rule",
    sourceLabel: profile
      ? `${profile.config.endpoint} · ${profile.config.model}`
      : "本地规则",
    memberId: userId,
    createdAt: new Date(now()).toISOString(),
    attachmentIds: ids,
    candidate,
    state: "pending",
  }));
  if (!access) return { drafts };
  access = membership(database, bookId, userId);
  manager(access);
  if (access.book.revision !== body.revision)
    throw new HttpError(
      409,
      "识别期间账本已更新，请刷新后重试。",
      "revision_conflict",
    );
  const autoPost =
    !context.forceDrafts &&
    database
      .prepare("SELECT ai_auto_post FROM book_options WHERE book_id=?")
      .get(bookId)?.ai_auto_post === 1;
  let next;
  try {
    next = addAiDrafts(ledger, drafts, autoPost);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  const result = applyOperation({
    database,
    bookId,
    userId,
    now,
    source: context.source ?? (autoPost ? "ai-auto" : "ai"),
    body: {
      key: body.key,
      revision: body.revision,
      patch: ledgerPatch(ledger, next),
    },
  });
  return {
    ...result,
    drafts: result.ledger.aiDrafts.filter(
      (draft) => draft.sourceHash === sourceHash,
    ),
  };
}
export function confirmNetworkDraft(context, bookId, body) {
  const { database, userId, now } = context;
  const access = membership(database, bookId, userId);
  manager(access);
  const ledger = snapshot(access).ledger,
    draft = ledger.aiDrafts?.find((item) => item.id === body.draftId);
  if (!draft || (access.role === "member" && draft.memberId !== userId))
    throw new HttpError(404, "草稿不存在或无权修改。");
  const command = {
    type: "ai-confirm",
    draftId: body.draftId,
    entry: body.entry,
  };
  const previous = database
    .prepare(
      "SELECT digest FROM book_requests WHERE book_id=? AND user_id=? AND request_key=?",
    )
    .get(bookId, userId, body.key ?? "");
  if (previous && previous.digest !== digest({ command }))
    throw new HttpError(409, "幂等键已用于另一项操作。");
  if (draft.state === "confirmed") return snapshot(access);
  if (!body.entry || typeof body.entry !== "object")
    throw new HttpError(400, "确认草稿时请提交核对后的完整交易 entry。");
  let next;
  try {
    next = confirmAiDraft(ledger, body.draftId, body.entry);
  } catch (error) {
    throw new HttpError(400, error.message);
  }
  return applyOperation({
    database,
    bookId,
    userId,
    now,
    source: context.source ?? "ai-confirm",
    command,
    body: {
      key: body.key,
      revision: body.revision,
      patch: ledgerPatch(ledger, next),
    },
  });
}
export async function aiApi(context) {
  const { path, request, response, database, userId, now, readBody } = context;
  const match = path.match(
    /^\/api\/(?:network\/books\/([a-z0-9-]+)\/)?ai\/(recognize|confirm|options)$/,
  );
  if (!match) return false;
  const bookId = match[1] ?? null,
    action = match[2];
  if (action === "recognize" && request.method === "POST") {
    json(response, 200, await recognizeAi(context, bookId, await readBody()));
    return true;
  }
  if (action === "confirm" && bookId && request.method === "POST") {
    json(response, 200, confirmNetworkDraft(context, bookId, await readBody()));
    return true;
  }
  if (action === "options" && bookId) {
    const access = membership(database, bookId, userId);
    if (request.method === "GET") {
      json(response, 200, {
        autoPost:
          database
            .prepare("SELECT ai_auto_post FROM book_options WHERE book_id=?")
            .get(bookId)?.ai_auto_post === 1,
      });
      return true;
    }
    if (request.method === "PUT") {
      const body = await readBody();
      requireManager(membership(database, bookId, userId));
      if (typeof body.autoPost !== "boolean")
        throw new HttpError(400, "请选择是否自动入账。");
      database
        .prepare(
          "INSERT INTO book_options VALUES(?,?) ON CONFLICT(book_id) DO UPDATE SET ai_auto_post=excluded.ai_auto_post",
        )
        .run(bookId, body.autoPost ? 1 : 0);
      auditMembership(
        database,
        bookId,
        userId,
        body.autoPost ? "开启 AI 自动入账" : "关闭 AI 自动入账",
        now,
        "settings",
      );
      json(response, 200, { autoPost: body.autoPost });
      return true;
    }
    void access;
  }
  return false;
}
