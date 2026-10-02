export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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
export async function readJson(request) {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "请求必须使用 JSON。");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024)
      throw new HttpError(413, "账本超过 20 MB 限制。");
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
export function createLimiter() {
  const attempts = new Map();
  return (request) => {
    const now = Date.now();
    const address = request.socket.remoteAddress ?? "unknown";
    const previous = attempts.get(address);
    const current =
      previous && now - previous.start < 60000
        ? previous
        : { start: now, count: 0 };
    current.count++;
    attempts.set(address, current);
    if (attempts.size > 10000) {
      for (const [key, value] of attempts) {
        if (now - value.start > 60000) attempts.delete(key);
      }
    }
    if (current.count > 30)
      throw new HttpError(429, "请求过于频繁，请稍后再试。");
  };
}
