import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "../dist/client");
const assets = await readdir(resolve(root, "assets"));
const files = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  ...assets.map((name) => "/assets/" + name),
];
const version = createHash("sha256")
  .update(await readFile(resolve(root, "index.html")))
  .digest("hex")
  .slice(0, 16);
await writeFile(
  resolve(root, "sw.js"),
  `const CACHE='hamster-shell-${version}';
const FILES=${JSON.stringify(files)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('hamster-shell-')&&key!==CACHE).slice(0,-1).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||caches.match(event.request)).then(cached=>cached||fetch(event.request)));});\n`,
);
console.log("Prepared offline app shell:", version);
