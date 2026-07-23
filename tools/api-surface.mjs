#!/usr/bin/env node
/**
 * 公開 API サーフェスのスナップショット検査(オフライン)。
 *  - 各パッケージ src/index.ts の export 名を収集し、スナップショットと比較。
 *  - export の「削除・リネーム」を破壊的変更として検出(追加は許容=警告)。
 * 使い方:
 *   node tools/api-surface.mjs          … スナップショットと比較(CI 用。差分あれば exit 1)
 *   node tools/api-surface.mjs --update … スナップショットを再生成
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "docs/platform/api-surface.json");

const EXPORT_DECL = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
// `export { a, b }` と `export type { A, B }` の両方を拾う。
// type を落とすと、型だけを外に出しているパッケージ(theme など)の記録が空になる。
const EXPORT_NAMED = /export\s+(?:type\s+)?\{([^}]*)\}/g;

/** ソースから export 名を抽出(re-export の `X as Y` は Y を採用)。 */
function extractExports(src) {
  const names = new Set();
  for (const m of src.matchAll(EXPORT_DECL)) names.add(m[1]);
  for (const m of src.matchAll(EXPORT_NAMED)) {
    for (const part of m[1].split(",")) {
      const token = part.trim().replace(/^type\s+/, "");
      if (!token) continue;
      const asMatch = token.split(/\s+as\s+/);
      const name = (asMatch[1] ?? asMatch[0]).trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

/** index.ts の `export * from "./x"` を辿って集約(拡張子なし・.js 付きの両対応)。 */
function collectPackageSurface(pkgDir) {
  const indexPath = join(pkgDir, "src/index.ts");
  if (!existsSync(indexPath)) return null;
  const seen = new Set();
  const names = new Set();
  function walk(filePath) {
    if (seen.has(filePath) || !existsSync(filePath)) return;
    seen.add(filePath);
    const src = readFileSync(filePath, "utf8");
    for (const n of extractExports(src)) names.add(n);
    for (const m of src.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
      if (!m[1].startsWith(".")) continue;
      // 拡張子は付いていないのが既定(moduleResolution: Bundler)。
      // 古いコードが .js を付けている場合にも備える。
      const stem = m[1].replace(/\.js$/, "");
      // 相対パスは**そのファイルのある場所**から解決する。
      // src/ 起点で解決すると、入れ子(src/core/index.ts の "./datacenter")を辿れず、
      // その配下の export がすべて記録から漏れる(実際に @platform/zoho で起きていた)。
      const fromDir = dirname(filePath);
      for (const cand of [`${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`]) {
        const p = join(fromDir, cand);
        if (existsSync(p)) { walk(p); break; }
      }
    }
  }
  walk(indexPath);
  return [...names].sort();
}

function collectAll() {
  const surface = {};
  const base = join(ROOT, "packages");
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(base, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const name = JSON.parse(readFileSync(pkgPath, "utf8")).name;
    const s = collectPackageSurface(join(base, entry.name));
    if (s) surface[name] = s;
  }
  return surface;
}

const current = collectAll();
const update = process.argv.includes("--update");

if (update || !existsSync(SNAPSHOT)) {
  writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + "\n");
  console.log(`✅ API サーフェスを保存: ${Object.keys(current).length} パッケージ`);
  process.exit(0);
}

const prev = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
let breaking = 0, added = 0;
for (const [pkg, prevExports] of Object.entries(prev)) {
  const now = new Set(current[pkg] ?? []);
  const removed = prevExports.filter((e) => !now.has(e));
  if (!current[pkg]) { console.error(`❌ パッケージ削除: ${pkg}`); breaking++; continue; }
  if (removed.length > 0) { console.error(`❌ ${pkg}: export 削除 → ${removed.join(", ")}`); breaking += removed.length; }
}
for (const [pkg, nowExports] of Object.entries(current)) {
  const before = new Set(prev[pkg] ?? []);
  const news = nowExports.filter((e) => !before.has(e));
  if (news.length > 0) { console.log(`➕ ${pkg}: 追加 ${news.join(", ")}`); added += news.length; }
}

console.log(`\n追加 ${added} 件 / 破壊的変更 ${breaking} 件`);
if (breaking > 0) { console.error("❌ 公開 API に破壊的変更があります(意図的なら --update で更新)"); process.exit(1); }
console.log("✅ 公開 API に破壊的変更なし");
