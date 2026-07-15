/**
 * Next.js App Router のファイル構成から「API 一覧」と「画面(ルート)一覧」を生成する(人向けドキュメント)。
 *   node tools/gen-app-map.mjs                # 全アプリを docs/platform/appmap/<app>.md に出力
 *   node tools/gen-app-map.mjs internal-app   # 指定アプリのみ
 * route.ts の HTTP メソッド export と page.tsx のパスを走査し、URL に変換する。
 * 動的セグメント [id] は :id 表記に。API はメソッド、画面はパスと(あれば)metadata.title を出す。
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      yield* walk(p);
    } else yield p;
  }
}

/** app ディレクトリ基準の物理パス → URL パス([id]→:id、route グループ (x) は除去)。 */
function toUrl(appDir, filePath) {
  let rel = path.relative(appDir, path.dirname(filePath));
  const segments = rel.split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
  const url = "/" + segments.map((s) => s.replace(/^\[\.\.\.(.+)\]$/, "*$1").replace(/^\[(.+)\]$/, ":$1")).join("/");
  return url === "/" ? "/" : url.replace(/\/$/, "");
}

function analyze(app) {
  const appDir = path.join(ROOT, "apps", app, "src", "app");
  if (!existsSync(appDir)) return null;
  const apis = [];
  const pages = [];
  const navLinks = [];
  for (const file of walk(appDir)) {
    const base = path.basename(file);
    if (base === "route.ts") {
      const src = readFileSync(file, "utf8");
      const methods = METHODS.filter((m) => new RegExp(`export\\s+(?:async\\s+function|const)\\s+${m}\\b`).test(src));
      if (methods.length > 0) apis.push({ url: toUrl(appDir, file), methods });
    } else if (base === "page.tsx") {
      const src = readFileSync(file, "utf8");
      const titleMatch = src.match(/title:\s*["'`]([^"'`]+)["'`]/);
      pages.push({ url: toUrl(appDir, file), title: titleMatch ? titleMatch[1] : "" });
    }
    if (base === "page.tsx" || base.endsWith(".tsx")) {
      // 画面から張られる内部リンク(href="/..." で /api を除く)を収集
      const src = readFileSync(file, "utf8");
      const pageUrl = toUrl(appDir, file);
      const links = new Set();
      for (const m of src.matchAll(/href=["'`](\/[^"'`?#]*)["'`]/g)) {
        const to = m[1];
        if (to.startsWith("/api/")) continue; // API は除外
        links.add(to === "" ? "/" : to.replace(/\/$/, "") || "/");
      }
      if (base === "page.tsx" && links.size > 0) navLinks.push({ from: pageUrl, to: [...links] });
    }
  }
  apis.sort((a, b) => a.url.localeCompare(b.url));
  pages.sort((a, b) => a.url.localeCompare(b.url));
  // 重複マージ(同一 from の複数コンポーネントを1つに)
  const navMap = new Map();
  for (const n of navLinks) {
    const set = navMap.get(n.from) ?? new Set();
    for (const t of n.to) set.add(t);
    navMap.set(n.from, set);
  }
  const nav = [...navMap.entries()].map(([from, set]) => ({ from, to: [...set].sort() })).sort((a, b) => a.from.localeCompare(b.from));
  return { app, apis, pages, nav };
}

function toMarkdown({ app, apis, pages, nav }) {
  const lines = [`# ${app} 画面・API 一覧(自動生成）`, "", `> 再生成: \`node tools/gen-app-map.mjs ${app}\`。画面 ${pages.length} / API ${apis.length}。手で編集しない。`, ""];
  lines.push(`## 画面(${pages.length})`, "");
  if (pages.length === 0) lines.push("なし。", "");
  else { lines.push("| パス | タイトル |", "|---|---|"); for (const p of pages) lines.push(`| \`${p.url}\` | ${p.title || "—"} |`); lines.push(""); }
  // 画面遷移図(既知ページ間のみ)
  const pageUrls = new Set(pages.map((p) => p.url));
  const edges = [];
  for (const n of nav) {
    if (!pageUrls.has(n.from)) continue;
    for (const to of n.to) if (pageUrls.has(to) && to !== n.from) edges.push([n.from, to]);
  }
  if (edges.length > 0) {
    const idOf = (url) => "P" + url.replace(/[^A-Za-z0-9]/g, "_");
    lines.push(`## 画面遷移(${edges.length} 遷移)`, "", "```mermaid", "flowchart LR");
    const nodeSet = new Set();
    for (const [from, to] of edges) { nodeSet.add(from); nodeSet.add(to); }
    for (const url of [...nodeSet].sort()) {
      const pg = pages.find((p) => p.url === url);
      lines.push(`  ${idOf(url)}["${pg?.title || url}"]`);
    }
    for (const [from, to] of edges) lines.push(`  ${idOf(from)} --> ${idOf(to)}`);
    lines.push("```", "");
  }
  lines.push(`## API(${apis.length})`, "");
  if (apis.length === 0) lines.push("なし。", "");
  else { lines.push("| エンドポイント | メソッド |", "|---|---|"); for (const a of apis) lines.push(`| \`${a.url}\` | ${a.methods.join(", ")} |`); lines.push(""); }
  return lines.join("\n");
}

function generate(app) {
  const r = analyze(app);
  if (!r || (r.apis.length === 0 && r.pages.length === 0)) return null;
  const outDir = path.join(ROOT, "docs/platform/appmap");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${app}.md`), toMarkdown(r));
  return { app, apis: r.apis.length, pages: r.pages.length };
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  const apps = target ? [target] : readdirSync(path.join(ROOT, "apps")).filter((a) => existsSync(path.join(ROOT, "apps", a, "src", "app")));
  const results = [];
  for (const app of apps) {
    const r = generate(app);
    if (r) { results.push(r); console.log(`✅ docs/platform/appmap/${r.app}.md 生成(画面 ${r.pages} / API ${r.apis})`); }
  }
  if (results.length === 0) console.log("App Router の対象が見つかりませんでした");
}

export { analyze, toUrl, toMarkdown };
