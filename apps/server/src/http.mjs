export class HttpError extends Error {
  constructor(status, message, code = "request_failed", headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}
export function json(response, status, value, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(value));
}
export async function readJson(request, maxBytes = 20 * 1024 * 1024) {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "请求必须使用 JSON。");
  if (Number(request.headers["content-length"]) > maxBytes)
    throw new HttpError(413, "请求内容超过大小限制。", "payload_too_large");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes)
      throw new HttpError(413, "请求内容超过大小限制。", "payload_too_large");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "JSON 格式无效。");
  }
}
export function verifyWriteOrigin(request, origin) {
  if (["GET", "HEAD"].includes(request.method)) return;
  if (
    request.headers.origin !== origin ||
    request.headers["x-hamster-client"] !== "1"
  )
    throw new HttpError(403, "请求来源不匹配。");
}
