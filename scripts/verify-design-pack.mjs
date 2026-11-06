import assert from "node:assert/strict";
import { readFile, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const folder = path.join(repository, "docs/design/receipt-relay-2026-11-06");
const json = async (filename) =>
  JSON.parse(await readFile(path.join(folder, filename), "utf8"));
const [catalog, capture, accessibility] = await Promise.all([
  json("catalog.json"),
  json("capture-audit.json"),
  json("accessibility-audit.json"),
]);
const ids = new Set(catalog.map((scene) => scene.id));
assert.equal(ids.size, catalog.length, "存在重复稿件ID");
const expected = catalog.flatMap((scene) =>
  [
    !scene.webOnly && `mobile:${scene.id}`,
    !scene.mobileOnly && `desktop:${scene.id}`,
  ].filter(Boolean),
);
assert.equal(capture.complete, true, "导出尚未完成");
assert.equal(accessibility.complete, true, "可访问性检查尚未完成");
assert.equal(
  capture.results.length,
  expected.length,
  "导出数量与平台范围不一致",
);
assert.equal(
  accessibility.results.length,
  expected.length,
  "检查数量与平台范围不一致",
);
const seen = new Set();
for (const scene of catalog) {
  assert.match(scene.id, /^[a-z0-9-]+$/);
  assert.ok(
    scene.title && scene.intent && scene.sources.length,
    `稿件缺少设计依据：${scene.id}`,
  );
  for (const source of scene.sources) {
    assert.ok(source.startsWith("apps/"), `不允许的来源路径：${source}`);
    await access(path.join(repository, source));
  }
  const links = [
    ...scene.actions,
    ...scene.blocks.flatMap((block) => block.items ?? []),
  ].filter((item) => item.target);
  for (const link of links)
    assert.ok(
      ids.has(link.target),
      `${scene.id} 引用了不存在的稿件 ${link.target}`,
    );
}
let imageCount = 0;
for (const frame of capture.results) {
  const key = `${frame.mode}:${frame.id}`;
  assert.ok(expected.includes(key), `平台范围不匹配：${key}`);
  assert.ok(!seen.has(key), `重复导出：${key}`);
  seen.add(key);
  assert.equal(frame.errors.length, 0, `${key} 有脚本错误`);
  assert.equal(frame.overlay, false, `${key} 有框架错误覆盖层`);
  assert.equal(frame.horizontalOverflow.length, 0, `${key} 横向越界`);
  assert.ok(
    frame.actions.every((action) => action.visible),
    `${key} 固定操作区不可见`,
  );
  assert.ok(
    frame.images.every((image) => image.width > 0),
    `${key} 图片资源未加载`,
  );
  const expectedWidth = frame.mode === "mobile" ? 780 : 1440;
  const expectedHeight = frame.mode === "mobile" ? 1688 : 1024;
  for (const file of [frame.file, frame.continued].filter(Boolean)) {
    const bytes = await readFile(path.join(folder, file));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG", `${file} 不是PNG`);
    assert.equal(
      bytes.subarray(-8, -4).toString(),
      "IEND",
      `${file} PNG不完整`,
    );
    assert.equal(bytes.readUInt32BE(16), expectedWidth, `${file} 宽度错误`);
    assert.equal(bytes.readUInt32BE(20), expectedHeight, `${file} 高度错误`);
    imageCount++;
  }
}
const auditedFrames = new Set();
for (const frame of accessibility.results) {
  const key = `${frame.mode}:${frame.id}`;
  assert.ok(!auditedFrames.has(key), `重复可访问性记录：${key}`);
  auditedFrames.add(key);
  assert.ok(seen.has(`${frame.mode}:${frame.id}`), "可访问性报告对应稿件缺失");
  assert.equal(
    frame.issues.length,
    0,
    `${frame.mode}:${frame.id} 存在WCAG A/AA问题`,
  );
}
assert.deepEqual(
  [...auditedFrames].sort(),
  [...seen].sort(),
  "可访问性覆盖与导出不一致",
);
const [boards, boardCapture, offline] = await Promise.all([
  json("board-index.json"),
  json("board-capture-audit.json"),
  json("offline-gallery-evidence.json"),
]);
assert.equal(boardCapture.complete, true, "看板导出尚未完成");
assert.equal(offline.passed, true, "离线图集未通过浏览器检查");
assert.equal(offline.initial.protocol, "file:", "未验证直接打开离线图集");
assert.equal(new Set(boards.map((board) => board.id)).size, boards.length);
assert.equal(boardCapture.results.length, boards.length);
assert.equal(
  new Set(boardCapture.results.map((board) => board.id)).size,
  boards.length,
  "看板检查存在重复记录",
);
for (const board of boards) {
  const captured = boardCapture.results.find((item) => item.id === board.id);
  assert.ok(captured, `缺少看板检查：${board.id}`);
  assert.equal(captured.images, board.scenes.length);
  assert.equal(captured.width, board.width);
  const html = await readFile(path.join(folder, board.html), "utf8");
  for (const id of board.scenes) {
    assert.ok(seen.has(`${board.mode}:${id}`), `看板引用不存在的稿件：${id}`);
    assert.ok(html.includes(`../screens/${board.mode}/${id}.png`));
  }
  const bytes = await readFile(path.join(folder, board.png));
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.equal(bytes.subarray(-8, -4).toString(), "IEND");
  assert.equal(bytes.readUInt32BE(16), board.width);
  assert.equal(bytes.readUInt32BE(20), captured.height);
}
const requiredRoutes = {
  overview: "overview",
  transactions: "transactions",
  import: "import",
  review: "duplicate",
  assets: "assets",
  calendar: "calendar",
  budgets: "budgets",
  reports: "reports",
  recurring: "recurring",
  tools: "tools",
};
const requiredTools = {
  "payment-inbox": "payment-inbox",
  ai: "ai-input",
  planning: "subscriptions",
  notifications: "notifications",
  network: "network",
  account: "sessions",
  sync: "sync",
  books: "books",
  import: "import",
  review: "duplicate",
  calendar: "calendar",
  budgets: "budgets",
  recurring: "recurring",
  categories: "categories",
  backup: "backup",
  preferences: "preferences",
};
const androidMainRoutes = {
  overview: "overview",
  records: "transactions",
  assets: "assets",
  reports: "reports",
  tools: "tools",
};
const androidMainSource = await readFile(
  path.join(repository, "apps/mobile/src/ui/AppNavigation.tsx"),
  "utf8",
);
const actualAndroidMain = [
  ...androidMainSource.matchAll(/key:\s*"([a-z-]+)"/g),
].map((match) => match[1]);
assert.deepEqual(
  [...actualAndroidMain].sort(),
  Object.keys(androidMainRoutes).sort(),
  "Android主导航发生变化，需要更新设计覆盖矩阵",
);
for (const id of Object.values(androidMainRoutes)) assert.ok(ids.has(id));
const routeSource = await readFile(
  path.join(repository, "apps/web/src/app-config.ts"),
  "utf8",
);
const actualRoutes = [...routeSource.matchAll(/\|\s*"([a-z-]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  [...actualRoutes].sort(),
  Object.keys(requiredRoutes).sort(),
  "Web路由发生变化，需要更新设计覆盖矩阵",
);
const toolSource = await readFile(
  path.join(repository, "apps/mobile/src/screens/ToolsScreen.tsx"),
  "utf8",
);
const actualTools = [...toolSource.matchAll(/key:\s*"([a-z-]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  [...actualTools].sort(),
  Object.keys(requiredTools).sort(),
  "Android工具入口发生变化，需要更新设计覆盖矩阵",
);
for (const id of [
  ...Object.values(requiredRoutes),
  ...Object.values(requiredTools),
])
  assert.ok(ids.has(id));
const assetIds = catalog
  .filter((scene) => scene.group === "资产与报表")
  .map((scene) => scene.id);
const result = {
  complete: true,
  selectedDirection: "本轮第3张 · 凭证接力",
  priority: "资产管理",
  scenes: catalog.length,
  mobile: capture.results.filter((frame) => frame.mode === "mobile").length,
  desktop: capture.results.filter((frame) => frame.mode === "desktop").length,
  pngs: imageCount,
  scrollingContinuations: capture.results.filter((frame) => frame.continued)
    .length,
  boards: boards.length,
  offlineGallery: "file protocol verified",
  wcagViolations: 0,
  webRoutes: requiredRoutes,
  androidMainRoutes,
  androidToolRoutes: requiredTools,
  assetPriorityScenes: assetIds,
};
await writeFile(
  path.join(folder, "coverage-verification.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
