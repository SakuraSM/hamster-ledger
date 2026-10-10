import { lookup } from "node:dns/promises";
import { isIP, BlockList } from "node:net";
import http from "node:http";
import https from "node:https";
import { HttpError } from "./http.mjs";
const local = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["100.64.0.0", 10],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  local.addSubnet(address, prefix, "ipv4");
const forbidden = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["169.254.0.0", 16],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  forbidden.addSubnet(address, prefix, "ipv4");
forbidden.addAddress("100.100.100.200", "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["fe80::", 10],
  ["ff00::", 8],
])
  forbidden.addSubnet(address, prefix, "ipv6");
export function allowedModelAddress(address, allowLan) {
  // Block IPv4-mapped IPv6 unless its embedded address passes the IPv4 policy.
  if (address.toLowerCase().startsWith("::ffff:")) {
    const tail = address.slice(7);
    if (isIP(tail) === 4) return allowedModelAddress(tail, allowLan);
    const words = tail.split(":");
    if (words.length !== 2) return false;
    const value = words.map((word) => parseInt(word, 16));
    return allowedModelAddress(
      `${value[0] >> 8}.${value[0] & 255}.${value[1] >> 8}.${value[1] & 255}`,
      allowLan,
    );
  }
  const family = isIP(address);
  if (!family || forbidden.check(address, family === 4 ? "ipv4" : "ipv6"))
    return false;
  return (
    allowLan ||
    (family === 4
      ? !local.check(address, "ipv4")
      : /^[23]/.test(address) && !/^2001:(db8|0):/i.test(address))
  );
}
export function modelUrl(endpoint, allowLan) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new HttpError(400, "模型地址无效。");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["http:", "https:"].includes(url.protocol) ||
    (url.protocol === "http:" && !allowLan)
  )
    throw new HttpError(400, "模型地址须使用 HTTPS；局域网 HTTP 需显式开启。");
  return url;
}
async function lookupWithDeadline(hostname, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      lookup(hostname, { all: true }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new HttpError(504, "模型地址解析超时。")),
          Math.min(timeoutMs, 5000),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function requestModel({
  config,
  key,
  path,
  body,
  timeoutMs = 20000,
}) {
  const url = modelUrl(
    config.endpoint.replace(/\/$/, "") + path,
    config.allowLan,
  );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookupWithDeadline(hostname, timeoutMs);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "无法解析模型服务地址。");
  }
  if (
    !addresses.length ||
    addresses.some(
      (item) => !allowedModelAddress(item.address, config.allowLan),
    )
  )
    throw new HttpError(400, "模型服务地址不在允许的网络范围内。");
  const pinned = addresses[0];
  const payload = body ? JSON.stringify(body) : undefined;
  return await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: body ? "POST" : "GET",
        lookup: (_host, options, done) =>
          options.all
            ? done(null, [pinned])
            : done(null, pinned.address, pinned.family),
        headers: {
          Accept: "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        let size = 0;
        const chunks = [];
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2 * 1024 * 1024)
            request.destroy(new HttpError(502, "模型响应过大。"));
          else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          if (response.statusCode !== 200)
            return reject(
              new HttpError(
                response.statusCode === 429 ? 429 : 502,
                response.statusCode === 429
                  ? "模型服务限流，请稍后重试。"
                  : `模型服务请求失败（${response.statusCode}）。`,
              ),
            );
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new HttpError(502, "模型服务返回的 JSON 无效。"));
          }
        });
      },
    );
    const timer = setTimeout(
      () => request.destroy(new HttpError(504, "模型请求超时，请稍后重试。")),
      timeoutMs,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", (error) =>
      reject(
        error instanceof HttpError
          ? error
          : new HttpError(502, "无法连接模型服务。"),
      ),
    );
    request.end(payload);
  });
}
