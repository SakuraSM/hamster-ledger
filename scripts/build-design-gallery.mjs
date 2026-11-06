import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "docs/design/receipt-relay-2026-11-06");
const scenes = JSON.parse(
  await readFile(path.join(target, "catalog.json"), "utf8"),
);
const capture = JSON.parse(
  await readFile(path.join(target, "capture-audit.json"), "utf8"),
);
if (!capture.complete)
  throw new Error("视觉稿尚未全部导出，不能生成交付图集。");
const payload = JSON.stringify({
  scenes,
  captures: capture.results,
}).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仓鼠记账 · 凭证接力全页面视觉稿</title><style>
[hidden]{display:none!important}:root{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#24251f;background:#eae8df}*{box-sizing:border-box}body{margin:0}button,input,a{font:inherit}button{cursor:pointer}a{color:inherit}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #ac542d;outline-offset:3px}.gallery{display:grid;grid-template-columns:260px 1fr;min-height:100vh}.index{height:100vh;position:sticky;top:0;background:#262a20;color:#e7ead9;padding:26px 18px;display:flex;flex-direction:column}.index h1{font-size:21px;line-height:1.4;margin:0 0 5px}.index>p{font-size:11px;line-height:1.7;color:#c2cbaa;margin:0 0 20px}.modes{display:flex;gap:8px;margin-bottom:15px}.modes button{border:1px solid #697456;border-radius:8px;background:none;color:#e0e7c8;padding:8px 16px;font-size:12px}.modes button.active{background:#e0e5c1;color:#27321e;border-color:#e0e5c1}.search{background:#363d2a;border:1px solid #566044;color:white;padding:10px 12px;border-radius:8px;font-size:12px;width:100%;margin-bottom:17px}.search::placeholder{color:#c3cdaa}.pages{overflow:auto;min-height:0;scrollbar-width:thin}.pages h2{font-size:10px;color:#b8c5a0;margin:18px 10px 7px}.pages button{display:block;width:100%;text-align:left;border:0;padding:9px 10px;border-radius:7px;background:none;color:#e7edda;font-size:12px;line-height:1.5}.pages button.active{background:#e0e5c1;color:#27321e}.bottom{font-size:10px;line-height:1.8;margin-top:15px;border-top:1px solid #4e5940;padding-top:13px;color:#c3cdaa}.work{min-width:0}.toolbar{padding:20px 30px;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f5f3eb;border-bottom:1px solid #d5d8c7}.toolbar h2{font-size:19px;margin:0 0 5px}.toolbar p{font-size:11px;color:#606a50;margin:0}.actions{display:flex;gap:9px}.actions a,.actions button{display:inline-block;text-decoration:none;border:1px solid #b8c3a3;border-radius:7px;padding:9px 12px;font-size:11px;color:#465834;background:#fbfbf3}.stage{padding:30px;display:flex;justify-content:center;align-items:flex-start;gap:30px}.stage img{display:block;width:390px;height:auto;box-shadow:0 12px 50px #242a1514}.stage.desktop{display:block;overflow:auto}.stage.desktop img{width:1440px;max-width:100%}.notes{max-width:280px;color:#4f5d3d;padding-top:8px}.notes h3{font-size:23px;line-height:1.4;margin:0 0 15px}.notes p{font-size:12px;line-height:1.9}.notes small{display:block;font-size:10px;line-height:1.9;overflow-wrap:anywhere;color:#596c42}.notes .label{font-size:10px;margin-top:22px;color:#6d7b58}.intro{font-size:11px;padding:12px 30px;background:#e1e6c8;color:#465438;border-bottom:1px solid #cdd6ad}.count{font-size:10px;color:#c4d2a6;margin-top:7px}@media(max-width:1000px){.notes{display:none}.gallery{grid-template-columns:220px 1fr}}@media(max-width:650px){.gallery{display:block}.index{height:auto;position:relative;padding:18px}.pages{max-height:170px}.index>p,.search,.bottom{display:none}.toolbar{padding:15px}.toolbar .actions{flex-wrap:wrap}.stage{padding:15px 0}.stage img{width:min(390px,100%)}.stage.desktop img{width:1440px}.intro{padding:12px 15px}}
</style></head><body><div class="gallery"><aside class="index"><h1>凭证接力</h1><p>仓鼠记账 · 全页面视觉稿<br>2026-11-06 · 资产管理优先</p><div class="modes"><button data-mode="mobile">手机端</button><button data-mode="desktop">桌面端</button></div><input class="search" aria-label="搜索页面或状态" placeholder="搜索页面 / 状态"><nav class="pages" aria-label="视觉稿索引"></nav><div class="bottom">所有图片均为已导出的视觉稿。<br>各状态为独立虚构示例，不会提交真实账本。<div class="count"></div></div></aside><main class="work"><header class="toolbar"><div><h2 id="page-title"></h2><p id="page-meta"></p></div><div class="actions"><a id="open-image" target="_blank" rel="noopener">打开原图</a><a id="download-image" download>下载PNG</a><button id="continued">查看后续内容</button></div></header><div class="intro">资产管理重点：净资产组成、账户基准与流水、负债还款、余额校准、历史状态和外币估值。</div><section class="stage"><img id="artwork" alt=""><aside class="notes"><h3 id="note-title"></h3><p id="intent"></p><p class="label">本页状态</p><p id="subtitle"></p><p class="label">对应现有实现</p><div id="sources"></div><p class="label">阅读说明</p><p>手机稿为780×1688高清PNG，桌面稿为1440×1024。长页另有后续截图。此图集可离线浏览。</p></aside></section></main></div><script id="catalog" type="application/json">${payload}</script><script>
const book=JSON.parse(document.getElementById('catalog').textContent);let mode=new URLSearchParams(location.search).get('mode')==='desktop'?'desktop':'mobile';let selected=new URLSearchParams(location.search).get('scene')||'assets';let continued=false;const pages=document.querySelector('.pages');
const available=()=>book.scenes.filter(scene=>!(mode==='mobile'&&scene.webOnly)&&!(mode==='desktop'&&scene.mobileOnly));
function show(){const list=available();const scene=list.find(item=>item.id===selected)||list.find(item=>item.id==='assets')||list[0];selected=scene.id;const frame=book.captures.find(item=>item.id===selected&&item.mode===mode);if(!frame)throw new Error('缺少视觉稿：'+selected);const file=continued&&frame.continued?frame.continued:frame.file;document.getElementById('artwork').src=file;document.getElementById('artwork').alt=scene.title+' · '+(mode==='mobile'?'手机':'桌面')+'视觉稿';document.getElementById('page-title').textContent=scene.title;document.getElementById('page-meta').textContent=scene.group+' / '+selected+' / '+(mode==='mobile'?'390×844 @2x':'1440×1024');document.getElementById('note-title').textContent=scene.title;document.getElementById('intent').textContent=scene.intent;document.getElementById('subtitle').textContent=scene.subtitle;document.getElementById('sources').replaceChildren(...scene.sources.map(source=>{const node=document.createElement('small');node.textContent=source;return node;}));document.getElementById('open-image').href=file;document.getElementById('download-image').href=file;document.getElementById('continued').hidden=!frame.continued;document.getElementById('continued').textContent=continued?'返回首屏':'查看后续内容';document.querySelector('.stage').classList.toggle('desktop',mode==='desktop');document.querySelector('.count').textContent=book.scenes.length+'个页面与状态 / 本端'+list.length+'张';document.querySelectorAll('[data-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));index();}
function index(){const query=document.querySelector('.search').value.trim();const list=available().filter(scene=>(scene.title+' '+scene.group+' '+scene.id).includes(query));const groups=[...new Set(list.map(scene=>scene.group))];groups.sort((left,right)=>(left==='资产与报表'?-1:right==='资产与报表'?1:0));const nodes=[];for(const group of groups){const heading=document.createElement('h2');heading.textContent=group;nodes.push(heading);for(const scene of list.filter(item=>item.group===group)){const button=document.createElement('button');button.type='button';button.textContent=scene.title;button.className=scene.id===selected?'active':'';button.onclick=()=>{selected=scene.id;continued=false;show();};nodes.push(button);}}pages.replaceChildren(...nodes);}
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;continued=false;show();});document.getElementById('continued').onclick=()=>{continued=!continued;show();};document.querySelector('.search').oninput=index;show();
</script></body></html>`;
await writeFile(path.join(target, "index.html"), html);
console.log(
  JSON.stringify({
    scenes: scenes.length,
    frames: capture.results.length,
    gallery: "docs/design/receipt-relay-2026-11-06/index.html",
  }),
);

const { mkdir } = await import("node:fs/promises");
const boardFolder = path.join(target, "boards");
await mkdir(boardFolder, { recursive: true });
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const boardIndex = [];
async function writeBoard({ id, title, mode, frames }) {
  const mobile = mode === "mobile";
  const width = mobile ? 1270 : 1520;
  const tiles = frames
    .map(
      (frame) =>
        `<figure><img src="../${frame.file}" alt="${escape(frame.title)}"><figcaption><b>${escape(frame.title)}</b><span>${escape(frame.id)}</span></figcaption></figure>`,
    )
    .join("\n");
  const document = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escape(title)}</title><style>*{box-sizing:border-box}body{margin:0;padding:28px 30px 30px;background:#eae8df;color:#2a3022;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}h1{font-size:22px;letter-spacing:-.5px;margin:0 0 7px}p{font-size:11px;color:#5e6c49;margin:0 0 23px}.grid{display:grid;grid-template-columns:repeat(${mobile ? 3 : 2},${mobile ? 390 : 720}px);gap:20px}figure{margin:0;min-width:0}img{display:block;width:100%;height:auto;box-shadow:0 4px 20px #26341210}figcaption{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 2px 13px;font-size:11px;line-height:1.5}figcaption span{font-size:9px;color:#63734b}figcaption b{font-weight:550}</style><h1>${escape(title)}</h1><p>仓鼠记账 / 凭证接力 / 2026-11-06 / ${mobile ? "手机 390×844 @2x" : "桌面 1440×1024"} / 全部虚构样例</p><div class="grid">${tiles}</div></html>`;
  await writeFile(path.join(boardFolder, `${id}.html`), document);
  boardIndex.push({
    id,
    title,
    mode,
    width,
    html: `boards/${id}.html`,
    png: `boards/${id}.png`,
    scenes: frames.map((frame) => frame.id),
  });
}
for (const mode of ["mobile", "desktop"]) {
  const frames = capture.results.filter((frame) => frame.mode === mode);
  const size = mode === "mobile" ? 6 : 4;
  for (let index = 0; index < frames.length; index += size) {
    const number = String(Math.floor(index / size) + 1).padStart(2, "0");
    await writeBoard({
      id: `${mode}-${number}`,
      title: `${mode === "mobile" ? "手机" : "桌面"}视觉稿 / ${number}`,
      mode,
      frames: frames.slice(index, index + size),
    });
  }
}
const assetSelections = [
  {
    id: "assets-main",
    title: "资产管理 / 总览、负债与余额依据",
    ids: [
      "assets",
      "account-detail",
      "liability-detail",
      "card-repayment",
      "calibration-difference",
      "net-worth",
    ],
  },
  {
    id: "assets-history",
    title: "资产管理 / 历史、账户关联与估值边界",
    ids: [
      "account-history",
      "account-records",
      "asset-unassigned",
      "foreign-account",
      "missing-baseline",
      "asset-archived",
    ],
  },
  {
    id: "assets-types",
    title: "资产管理 / 账户类型与特殊余额",
    ids: [
      "account-types",
      "account-edit",
      "liability-edit",
      "credit-prepaid",
      "investment-account",
      "rates",
    ],
  },
];
for (const selection of assetSelections) {
  const frames = selection.ids.map((id) =>
    capture.results.find((frame) => frame.mode === "mobile" && frame.id === id),
  );
  assertFrames(frames);
  await writeBoard({
    id: selection.id,
    title: selection.title,
    mode: "mobile",
    frames,
  });
}
function assertFrames(frames) {
  if (frames.some((frame) => !frame))
    throw new Error("重点资产看板缺少必要视觉稿。");
}
await writeFile(
  path.join(target, "board-index.json"),
  JSON.stringify(boardIndex, null, 2) + "\n",
);
console.log(JSON.stringify({ boards: boardIndex.length }));
