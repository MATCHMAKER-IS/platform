/**
 * どこからも参照されていないドキュメント(孤立文書)を検出する。
 *
 * 資料は**見つけられなければ無いのと同じ**。実際、この検査を入れた時点で
 * 手書きの資料 9 件がどこからもリンクされていなかった
 * (新人向けの実地課題すら、書いた本人以外は辿り着けなかった)。
 *
 * 「書いたのに読まれない」を防ぐため、新しい資料を足したら
 * **必ずどこかから参照する**ことを機械的に守らせる。
 *
 * 自動生成物(ER 図・依存グラフ・アプリ地図)は生成ツールとサイトから使うため対象外。
 *
 * 実行: node tools/check-docs-orphans.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 対象外。自動生成物は `gen-*.mjs` と参照サイトが使うため、
 * 人が読む導線を必須にしない。
 */
const IGNORE = [
  /^docs\/platform\/erd\//,
  /^docs\/platform\/appmap\//,
  /^docs\/platform\/depgraph\.md$/,
  /^docs\/site\//,
  /^docs\/ai\/(module-list|advisor-report|platform-report)\.md$/,
  /^docs\/README\.md$/,       // 索引そのもの
  /^docs\/adr\/template\.md$/, // 雛形
];

/** 参照元として走査するファイル(資料 + 規約 + 生成ツール)。 */
function collectSources() {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(md|mjs|mts|ts|tsx|yml|yaml|json)$/.test(e.name)) out.push(fp);
    }
  };
  walk(path.join(ROOT, "docs"));
  walk(path.join(ROOT, "tools"));
  walk(path.join(ROOT, ".github"));
  for (const f of ["CLAUDE.md", "README.md", "CONTRIBUTING.md", "package.json"]) {
    const p = path.join(ROOT, f);
    if (existsSync(p)) out.push(p);
  }
  return out;
}

const docs = [];
const walkDocs = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walkDocs(fp);
    else if (e.name.endsWith(".md")) docs.push(fp);
  }
};
walkDocs(path.join(ROOT, "docs"));

const sources = collectSources();
const cache = new Map();
const bodyOf = (f) => {
  if (!cache.has(f)) cache.set(f, readFileSync(f, "utf8"));
  return cache.get(f);
};

const orphans = [];
for (const doc of docs) {
  const rel = path.relative(ROOT, doc).replace(/\\/g, "/");
  if (IGNORE.some((re) => re.test(rel))) continue;
  const base = path.basename(doc);
  const referenced = sources.some((f) => f !== doc && (bodyOf(f).includes(base) || bodyOf(f).includes(rel)));
  if (!referenced) orphans.push(rel);
}

if (orphans.length === 0) {
  console.log(`✅ すべての資料に辿り着けます(${docs.length} 件検査 / 自動生成物は対象外)`);
  process.exit(0);
}

for (const o of orphans) {
  console.log(`❌ ${o}: どこからも参照されていません(docs/README.md の「目的から探す」に追加してください)`);
}
console.log(`❌ 孤立した資料が ${orphans.length} 件。読まれない資料は無いのと同じです。`);
process.exit(1);
