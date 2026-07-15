/**
 * 人間が読むリファレンスサイト（自己完結 HTML）を生成する。
 *   node tools/gen-ref-site.mjs             → docs/site/index.html（基盤）＋ docs/site/app-<name>.html（各アプリ）
 *
 * 既存の生成物（module-list / api-reference.json / depgraph / erd / appmap）を統合し、
 * 検索できる 1 枚の HTML にする。CSS/JS 込みで外部依存なし。ブラウザで開くだけで読める。
 * 目的: 基盤が大きくなっても「どんな部品があるか・各アプリに何の画面と API があるか」を
 *       非エンジニアも含めて把握できるようにする。
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

/** HTML エスケープ。 */
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** パッケージ情報（module-list.md + api-reference.json + categories）を集める。 */
function collectPackages() {
  const refPath = path.join(ROOT, "docs/platform/api-reference.json");
  const apiRef = existsSync(refPath) ? JSON.parse(readFileSync(refPath, "utf8")) : {};
  const pkgDir = path.join(ROOT, "packages");
  const names = readdirSync(pkgDir).filter((d) => existsSync(path.join(pkgDir, d, "package.json")));
  const packages = [];
  for (const name of names) {
    const full = `@platform/${name}`;
    let summary = "";
    const readme = path.join(pkgDir, name, "README.md");
    if (existsSync(readme)) {
      const lines = readFileSync(readme, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
      summary = lines.find((l) => !l.startsWith("#")) ?? "";
    }
    const exportsList = (apiRef[full] ?? []).map((e) => ({
      name: e.name,
      kind: e.kind,
      summary: e.summary ?? "",
      ...(e.signature ? { signature: e.signature } : {}),
      ...(e.params ? { params: e.params } : {}),
      ...(e.returns ? { returns: e.returns } : {}),
      ...(e.throws ? { throws: e.throws } : {}),
      ...(e.example ? { example: e.example } : {}),
    }));
    packages.push({ name, full, summary, exports: exportsList });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** 依存グラフの Mermaid を取り出す。 */
function loadDepGraphMermaid() {
  const f = path.join(ROOT, "docs/platform/depgraph.md");
  if (!existsSync(f)) return "";
  const m = readFileSync(f, "utf8").match(/```mermaid\n([\s\S]*?)```/);
  return m ? m[1].trim() : "";
}

/** アプリの画面・API を appmap から集める。 */
function collectApps() {
  const dir = path.join(ROOT, "docs/platform/appmap");
  if (!existsSync(dir)) return [];
  const apps = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    const body = readFileSync(path.join(dir, file), "utf8");
    const pages = [];
    const apis = [];
    // 表の行 | `path` | title | を拾う
    for (const line of body.split("\n")) {
      const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|/);
      if (!m) continue;
      const p = m[1];
      const title = m[2] === "—" ? "" : m[2];
      if (p.startsWith("/api") || p.includes("/api/")) apis.push({ path: p, title });
      else pages.push({ path: p, title });
    }
    apps.push({ name, pages, apis });
  }
  return apps;
}

/** 各アプリの ER 図(Mermaid)を集める。 */
function collectErds() {
  const dir = path.join(ROOT, "docs/platform/erd");
  if (!existsSync(dir)) return [];
  const erds = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    const body = readFileSync(path.join(dir, file), "utf8");
    const m = body.match(/```mermaid\n([\s\S]*?)```/);
    if (m) erds.push({ name, mermaid: m[1].trim() });
  }
  return erds;
}

/** ADR(設計判断記録)のタイトル・状態・本文冒頭を集める。 */
function collectAdrs() {
  const dir = path.join(ROOT, "docs/adr");
  if (!existsSync(dir)) return [];
  const adrs = [];
  for (const file of readdirSync(dir).filter((f) => /^\d{4}.*\.md$/.test(f)).sort()) {
    const body = readFileSync(path.join(dir, file), "utf8");
    const lines = body.split("\n");
    const title = (lines.find((l) => l.startsWith("# ")) ?? "").replace(/^#\s*/, "").trim();
    const statusLine = lines.find((l) => l.includes("状態:")) ?? "";
    const status = statusLine.replace(/.*状態:\s*/, "").trim();
    // 見出し・箇条書きメタを除いた最初の段落を要約に
    const summary = lines.find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">")) ?? "";
    adrs.push({ file, title, status, summary: summary.trim() });
  }
  return adrs;
}

/**
 * 標準スキン(themes.ts)を静的に読み取る。ビルド不要でソースから拾うため、
 * `id` / `name` / `description` / 主要色だけを正規表現で抽出する。
 */
function collectThemes() {
  const f = path.join(ROOT, "packages/theme/src/themes.ts");
  if (!existsSync(f)) return [];
  const src = readFileSync(f, "utf8");
  const themes = [];
  // export const xxxTheme: Theme = { id: "...", name: "...", description: "...", shape: {...}, modes: { light: { ... } } }
  const blockRe = /export const \w+Theme: Theme = \{([\s\S]*?)\n\};/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const body = m[1];
    const pick = (key) => (body.match(new RegExp(`${key}:\\s*"([^"]*)"`)) ?? [])[1] ?? "";
    const light = (body.match(/light:\s*\{([^}]*)\}/) ?? [])[1] ?? "";
    const lightPick = (key) => (light.match(new RegExp(`${key}:\\s*"([^"]*)"`)) ?? [])[1] ?? "";
    const id = pick("id");
    if (!id) continue;
    themes.push({
      id,
      name: pick("name"),
      description: pick("description"),
      radius: Number((body.match(/radius:\s*(\d+)/) ?? [])[1] ?? 0),
      fontFamily: (body.match(/fontFamily:\s*"([^"]*)"/) ?? [])[1] ?? "",
      colors: { bg: lightPick("bg"), fg: lightPick("fg"), primary: lightPick("primary"), accent: lightPick("accent") },
    });
  }
  return themes;
}

const STYLE = `
:root{--bg:#f7f8fa;--fg:#1a1a2e;--muted:#6b7280;--surface:#fff;--border:#e5e7eb;--primary:#2563eb;--radius:10px}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 24px;position:sticky;top:0;z-index:10}
header h1{margin:0;font-size:18px}
.wrap{max-width:1000px;margin:0 auto;padding:24px}
.search{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;margin-bottom:20px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px}
.pkg-name{font-size:15px;font-weight:700;color:var(--primary)}
.pkg-summary{font-size:13px;color:var(--muted);margin:4px 0 8px}
.exp{font-size:12px;padding:6px 0;border-top:1px solid #f3f4f6}
.exp-head{display:flex;gap:8px;align-items:baseline}
.exp-detail{margin:4px 0 2px 12px;padding-left:8px;border-left:2px solid var(--border)}
.sig{font-size:11px;color:var(--muted);margin-bottom:3px;word-break:break-all}
.meta{font-size:11px;color:var(--fg);margin:2px 0}
.meta-label{display:inline-block;min-width:44px;color:var(--muted);font-weight:600}
.meta ul{margin:2px 0 2px 48px;padding:0}
.meta li{list-style:disc;margin:1px 0}
.meta.throws{color:#b45309}
.ex{margin-top:4px}
.ex summary{font-size:11px;color:var(--primary);cursor:pointer}
.ex pre{margin:4px 0;font-size:11px}
.exp code{color:#4338ca;min-width:180px}
.exp .kind{color:#999;min-width:70px;font-size:11px}
.exp .sum{color:#555}
.tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:6px 14px;border:1px solid var(--border);border-radius:999px;background:var(--surface);cursor:pointer;font-size:13px;text-decoration:none;color:var(--fg)}
.tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-weight:600}
.count{color:var(--muted);font-size:12px}
pre{background:#f8f8f8;padding:12px;border-radius:8px;overflow-x:auto;font-size:11px}
.hidden{display:none}
a{color:var(--primary)}
.cross{display:flex;gap:10px;align-items:center;padding:8px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);text-decoration:none;color:var(--fg);font-size:13px}
.cross:hover{border-color:var(--primary)}
.cross-type{font-size:11px;color:var(--muted);min-width:110px}
`;

const SEARCH_JS = `
function filterCards(q){
  q=q.toLowerCase();
  document.querySelectorAll('[data-search]').forEach(function(el){
    el.classList.toggle('hidden', q && el.getAttribute('data-search').toLowerCase().indexOf(q)<0);
  });
}
`;

function renderPlatformSite(packages, depMermaid, apps, erds, adrs, themes) {
  const totalExports = packages.reduce((a, p) => a + p.exports.length, 0);
  const pkgCards = packages.map((p) => {
    const exps = p.exports.map((e) => {
      const details = [];
      if (e.signature) details.push(`<div class="sig"><code>${esc(e.signature)}</code></div>`);
      if (e.params && e.params.length > 0) {
        details.push(
          `<div class="meta"><span class="meta-label">引数</span><ul>${e.params
            .map((a) => `<li><code>${esc(a.name)}</code> ${esc(a.description)}</li>`)
            .join("")}</ul></div>`,
        );
      }
      if (e.returns) details.push(`<div class="meta"><span class="meta-label">戻り値</span> ${esc(e.returns)}</div>`);
      if (e.throws && e.throws.length > 0) {
        details.push(`<div class="meta throws"><span class="meta-label">例外</span> ${e.throws.map((t) => esc(t)).join(" / ")}</div>`);
      }
      if (e.example) details.push(`<details class="ex"><summary>使用例</summary><pre><code>${esc(e.example)}</code></pre></details>`);
      const body = details.length > 0 ? `<div class="exp-detail">${details.join("")}</div>` : "";
      return `<div class="exp"><div class="exp-head"><code>${esc(e.name)}</code><span class="kind">${esc(e.kind)}</span><span class="sum">${esc(e.summary)}</span></div>${body}</div>`;
    }).join("");
    const searchText = `${p.name} ${p.summary} ${p.exports.map((e) => e.name).join(" ")}`;
    return `<div class="card" data-search="${esc(searchText)}"><div class="pkg-name">${esc(p.full)}</div><div class="pkg-summary">${esc(p.summary)}</div>${exps}</div>`;
  }).join("\n");

  const appLinks = (apps ?? []).map((a) => `<a class="tab" href="app-${esc(a.name)}.html">${esc(a.name)}</a>`).join("");

  // 横断検索用インデックス: パッケージ + 各アプリの画面/API を 1 つの検索対象に。
  const crossItems = [];
  for (const p of packages) {
    crossItems.push({ label: p.full, type: "パッケージ", href: "#packages", text: `${p.name} ${p.summary} ${p.exports.map((e) => e.name).join(" ")}` });
  }
  for (const a of apps ?? []) {
    for (const pg of a.pages) crossItems.push({ label: `${pg.path}${pg.title ? " — " + pg.title : ""}`, type: `画面(${a.name})`, href: `app-${a.name}.html`, text: `${pg.path} ${pg.title}` });
    for (const api of a.apis) crossItems.push({ label: `${api.path}${api.title ? " — " + api.title : ""}`, type: `API(${a.name})`, href: `app-${a.name}.html`, text: `${api.path} ${api.title}` });
  }
  const crossRows = crossItems.map((it) => `<a class="cross" href="${esc(it.href)}" data-x="${esc(it.text)}"><span class="cross-type">${esc(it.type)}</span><span>${esc(it.label)}</span></a>`).join("\n");

  // スキン一覧(非エンジニアにも「どんな見た目が選べるか」を示す)
  const themeCards = (themes ?? []).map((t) => `
    <div class="card" style="display:flex;gap:12px;align-items:center">
      <div style="display:flex;gap:3px">
        ${[t.colors.primary, t.colors.accent, t.colors.bg, t.colors.fg].filter(Boolean).map((c) => `<span style="width:22px;height:22px;border-radius:${Math.min(t.radius, 11)}px;background:${esc(c)};border:1px solid rgba(0,0,0,.15)"></span>`).join("")}
      </div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600">${esc(t.name)} <code style="font-size:11px;color:var(--muted)">${esc(t.id)}</code></div>
        <div style="font-size:12px;color:var(--muted)">${esc(t.description)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">角丸 ${t.radius}px / ${esc((t.fontFamily || "").split(",")[0].replace(/'/g, ""))}</div>
      </div>
    </div>`).join("\n");

  const erdBlocks = (erds ?? []).map((e) => `<div class="card"><div class="pkg-name">${esc(e.name)}</div><pre><code>${esc(e.mermaid)}</code></pre></div>`).join("\n");

  const adrRows = (adrs ?? []).map((a) => {
    const badge = a.status.includes("承認") ? "#16a34a" : a.status.includes("却下") || a.status.includes("廃止") ? "#c00" : "#6b7280";
    return `<div class="card" data-search="${esc(a.title + " " + a.summary)}"><div style="display:flex;justify-content:space-between;align-items:center"><div class="pkg-name" style="font-size:14px">${esc(a.title)}</div><span style="font-size:11px;color:#fff;background:${badge};padding:2px 8px;border-radius:999px">${esc(a.status || "—")}</span></div><div class="pkg-summary">${esc(a.summary)}</div></div>`;
  }).join("\n");

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>プラットフォーム リファレンス</title><style>${STYLE}</style></head><body>
<header><h1>プラットフォーム リファレンス</h1></header>
<div class="wrap">
<div class="tabs"><a class="tab active" href="#packages" onclick="showSection('packages')">基盤パッケージ</a><a class="tab" href="#cross" onclick="showSection('cross')">横断検索</a><a class="tab" href="#themes" onclick="showSection('themes')">テーマ（${(themes ?? []).length}スキン）</a><a class="tab" href="#design" onclick="showSection('design')">設計（依存/ER/ADR）</a>${appLinks}</div>

<section id="sec-packages">
<p class="count">${packages.length} パッケージ / ${totalExports} 公開 API。検索で絞り込めます。</p>
<input class="search" placeholder="パッケージ名・API名・説明で検索…" oninput="filterCards(this.value)">
${pkgCards}
</section>

<section id="sec-cross" class="hidden">
<p class="count">パッケージ・全アプリの画面/API を横断検索。${crossItems.length} 項目。</p>
<input class="search" placeholder="例: 辞書 / db-viewer / /api/ai …" oninput="filterCross(this.value)">
<div id="cross-list">${crossRows}</div>
</section>

<section id="sec-themes" class="hidden">
<p class="count">画面デザインは「スキン」で切り替えられます（WordPress のテーマのような仕組み）。明暗（ライト/ダーク）とは独立していて、後からスキンを追加できます。</p>
${themeCards || '<p class="count">スキン情報がありません。</p>'}
<div class="card">
<div style="font-size:14px;font-weight:600;margin-bottom:6px">スキンの追加方法（開発者向け）</div>
<p style="font-size:12px;color:var(--muted);margin:0 0 8px">主色などを指定すると、ライト/ダーク両方のスキンが自動生成されます。管理画面（/admin/themes）からブラウザ上で作ることもできます。</p>
<pre><code>import { deriveTheme, createThemeRegistry, builtInThemes } from "@platform/theme";

const registry = createThemeRegistry({ themes: builtInThemes });
registry.register(deriveTheme({
  id: "acme", name: "自社ブランド",
  primary: "#e60033",   // 主色（必須）
  base: "warm",         // 背景の系統: light | warm | cool
}));</code></pre>
<p style="font-size:12px;color:var(--muted);margin:8px 0 0">詳細は <code>packages/theme/README.md</code>（トークンの役割・作り方・アクセシビリティ確認）を参照。</p>
</div>
</section>

<section id="sec-design" class="hidden">
<h2>依存グラフ</h2>
<div class="card"><pre><code>${esc(depMermaid)}</code></pre><p class="count">Mermaid 記法。<a href="https://mermaid.live" target="_blank">mermaid.live</a> に貼ると図で見られます。</p></div>
<h2>ER 図（アプリ別）</h2>
${erdBlocks || '<p class="count">ER 図がありません。</p>'}
<h2>設計判断記録（ADR）</h2>
<input class="search" placeholder="ADR を検索…" oninput="filterCards(this.value)">
${adrRows || '<p class="count">ADR がありません。</p>'}
</section>
</div>
<script>${SEARCH_JS}
function filterCross(q){
  q=q.toLowerCase();
  document.querySelectorAll('#cross-list .cross').forEach(function(el){
    el.classList.toggle('hidden', q && el.getAttribute('data-x').toLowerCase().indexOf(q)<0);
  });
}
function showSection(id){
  ['packages','cross','themes','design'].forEach(function(s){
    var el=document.getElementById('sec-'+s);
    if(el)el.classList.toggle('hidden', s!==id);
  });
  document.querySelectorAll('.tabs .tab').forEach(function(t){ t.classList.remove('active'); });
  event.target.classList.add('active');
}
</script>
</body></html>`;
}

function renderAppSite(app) {
  const pageRows = app.pages.map((p) => `<tr data-search="${esc(p.path + " " + p.title)}"><td><code>${esc(p.path)}</code></td><td>${esc(p.title)}</td></tr>`).join("");
  const apiRows = app.apis.map((a) => `<tr data-search="${esc(a.path + " " + a.title)}"><td><code>${esc(a.path)}</code></td><td>${esc(a.title)}</td></tr>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(app.name)} リファレンス</title><style>${STYLE}</style></head><body>
<header><h1>${esc(app.name)} リファレンス</h1></header>
<div class="wrap">
<div class="tabs"><a class="tab" href="index.html">← 基盤に戻る</a></div>
<p class="count">画面 ${app.pages.length} / API ${app.apis.length}</p>
<input class="search" placeholder="パス・タイトルで検索…" oninput="filterCards(this.value)">
<h2>画面（${app.pages.length}）</h2>
<div class="card"><table><thead><tr><th>パス</th><th>タイトル</th></tr></thead><tbody>${pageRows}</tbody></table></div>
<h2>API（${app.apis.length}）</h2>
<div class="card"><table><thead><tr><th>パス</th><th>タイトル</th></tr></thead><tbody>${apiRows}</tbody></table></div>
</div>
<script>${SEARCH_JS.replace("filterCards", "filterCards")}
function filterRows(q){filterCards(q);}
</script>
</body></html>`;
}

function generate() {
  const packages = collectPackages();
  const depMermaid = loadDepGraphMermaid();
  const apps = collectApps();
  const erds = collectErds();
  const adrs = collectAdrs();
  const themes = collectThemes();
  const outDir = path.join(ROOT, "docs/site");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "index.html"), renderPlatformSite(packages, depMermaid, apps, erds, adrs, themes));
  for (const app of apps) {
    writeFileSync(path.join(outDir, `app-${app.name}.html`), renderAppSite(app));
  }
  return { packages: packages.length, apps: apps.length, erds: erds.length, adrs: adrs.length, themes: themes.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = generate();
  console.log(`✅ docs/site/ を生成(基盤 index.html + アプリ ${r.apps} 個。パッケージ ${r.packages} / ER図 ${r.erds} / ADR ${r.adrs} / スキン ${r.themes})`);
}

export { collectPackages, collectApps, collectErds, collectAdrs, collectThemes, loadDepGraphMermaid, renderPlatformSite, renderAppSite };
