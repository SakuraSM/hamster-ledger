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
} = {}) {
  const database = openDatabase(databasePath);
  const api = createApi({ database, publicOrigin, allowRegistration });
  const root = resolve(webRoot);
  const server = createServer(async (request, response) => {
    try {
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
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (!response.headersSent)
        json(response, error instanceof HttpError ? error.status : 500, {
          error:
            error instanceof HttpError
              ? error.message
              : "服务处理失败，请稍后重试。",
        });
      else response.end();
    }
  });
  server.on("close", () => database.close());
  return server;
}
