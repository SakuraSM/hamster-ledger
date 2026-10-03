import { startScheduler } from "./scheduler.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { openDatabase } from "./database.mjs";
import { createApi } from "./api.mjs";
import { json, HttpError } from "./http.mjs";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".csv": "text/csv; charset=utf-8",
};
export function createLedgerServer({
  databasePath = "data/ledger.sqlite",
  webRoot = "apps/web/dist/client",
  publicOrigin,
  allowRegistration = true,
  now = Date.now,
  enableScheduler = true,
  timeZone = "Asia/Shanghai",
} = {}) {
  validateOrigin(publicOrigin);
  const database = openDatabase(databasePath);
  const api = createApi({ database, publicOrigin, allowRegistration, now });
  const root = resolve(webRoot);
  const server = createServer(async (request, response) => {
    try {
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "same-origin");
      response.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
      if (publicOrigin?.startsWith("https:"))
        response.setHeader("Strict-Transport-Security", "max-age=31536000");
      if (!publicOrigin && !isLoopbackHost(request.headers.host))
        throw new HttpError(
          403,
          "非本机访问必须配置 HTTPS PUBLIC_ORIGIN。",
          "origin_not_configured",
        );
      if (request.url?.startsWith("/api/")) {
        await api(request, response);
        return;
      }
      if (!["GET", "HEAD"].includes(request.method))
        throw new HttpError(405, "请求方法不支持。");
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      let target = resolve(root, "." + pathname);
      if (!target.startsWith(root + sep) && target !== root)
        throw new HttpError(403, "路径不可访问。");
      let info;
      try {
        info = await stat(target);
      } catch {
        /* SPA routes fall back to the entry document. */
      }
      if (!info?.isFile()) target = resolve(root, "index.html");
      let content;
      try {
        content = await readFile(target);
      } catch {
        throw new HttpError(503, "网页尚未构建，请执行 npm run build。");
      }
      response.writeHead(200, {
        "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Cache-Control": "no-cache",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!response.headersSent)
        json(
          response,
          error instanceof HttpError ? error.status : 500,
          {
            error:
              error instanceof HttpError
                ? error.message
                : "服务处理失败，请稍后重试。",
            code: error instanceof HttpError ? error.code : "server_error",
          },
          error instanceof HttpError ? error.headers : {},
        );
      else response.end();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  const stopScheduler = enableScheduler
    ? startScheduler({ database, now, timeZone })
    : () => {};
  server.on("close", () => {
    stopScheduler();
    database.close();
  });
  return server;
}

function isLoopbackHost(host) {
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(
      new URL("http://" + host).hostname,
    );
  } catch {
    return false;
  }
}
function validateOrigin(origin) {
  if (!origin) return;
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password ||
    !["http:", "https:"].includes(parsed.protocol)
  )
    throw new Error(
      "PUBLIC_ORIGIN 必须是完整的 Origin，不含路径、凭据或末尾斜杠。",
    );
  if (parsed.protocol !== "https:" && !isLoopbackHost(parsed.host))
    throw new Error("非本机部署必须使用 HTTPS PUBLIC_ORIGIN。");
}
