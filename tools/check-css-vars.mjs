#!/usr/bin/env node
/**
 * **参照している CSS 変数が実際に定義されているかを確かめる。**
 *
 * 【なぜ要るか】
 * `check-hardcoded-colors` は「色を直書きせず `var(--color-…)` を使え」と言うが、
 * **その変数が存在するかは見ていない**。結果、こうなっていた(2026-08):
 *
 *  - `--font-mono` … **定義が無いのに 4 か所から参照**。`var(--font-mono, monospace)`
 *    とフォールバック付きだったので画面は壊れず、誰も気づかないまま
 *    素の `monospace`(多くの環境で Courier)で描画されていた
 *  - `--color-muted-bg` … 13 ファイルが参照。**うち 3 か所はフォールバック無し**で、
 *    背景色が効かない状態だった
 *  - 同じ変数に **`#f1f1f1` と `#f5f5f5` の 2 通りの既定値**が書かれており、
 *    どちらが正なのか分からなくなっていた
 *
 * **直書きより厄介**なのは、直書きは検査で見つかるがこれは通ることだ。
 * 「トークンを使っている」ように見えて、テーマを切り替えても変わらない。
 *
 * 【フォールバック付きも数える理由】
 * `var(--x, #f5f5f5)` は壊れないが、**テーマが効かない**ことに変わりはない。
 * 既定値が散らばると、正しい値がどれか誰にも分からなくなる。
 *
 * 実行:
 *   node tools/check-css-vars.mjs           未定義の参照を出す
 *   node tools/check-css-vars.mjs --set-limit 上限を現在値に下げる
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "css-vars-limit.json");
const SET = process.argv.includes("--set-limit");
// **一覧を出せるようにする。**
// **上限方式の検査には必ず `--list` を付けてください**——
// **どれが対象か分からないと、減らせません**（上限を守るだけになります）。
const LIST = process.argv.includes("--list");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/**
 * 対象外の変数。**理由を必ず添える。**
 */
const ALLOW = [
  { re: /^--(x|y)$/, why: "座標の受け渡し。呼び出し側が style で与える" },
  { re: /^--(bg|fg|card|border|muted|accent)$/, why: "status-page の独立した HTML テンプレート。同ファイル内で完結する" },
  // **`@platform/theme` が実行時に注入する。** テーマを切り替えるための変数なので、
  // tokens.css に固定値を書いてはいけない(書くと切り替わらなくなる)。
  // 一覧は `packages/theme/src/css.ts` の対応表から取っている。
  { re: /^--(font-family|heading-font-family|spacing|radius|shadow|elevation|color-sidebar-[\w-]+|color-nav-active-bg|color-card)$/,
    why: "@platform/theme が実行時に注入(テーマ切替のため固定値を持たせない)" },
  { re: /^--radix-/, why: "Radix UI が実行時に設定する" },
  { re: /^--dash-cols$/, why: "DashboardGrid が要素ごとに style で与える" },
  { re: /^--color-$/, why: "テーマ一覧画面で変数名を組み立てる途中の文字列" },
];

// **共通処理を使う**(除外ディレクトリの食い違いを防ぐ)。相対パスで返る
const files = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx", ".css"] })
  .filter((f) => !f.includes(".generated."));

// **定義は CSS からだけ拾う。** TS の中で `--x: …` と書けても、
// それはインラインスタイルで 1 要素にしか効かない
const defined = new Set();
for (const f of files) {
  if (!f.endsWith(".css")) continue;
  for (const m of readFileSync(f, "utf8").matchAll(/^\s*(--[\w-]+)\s*:/gm)) defined.add(m[1]);
}

const missing = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/var\((--[\w-]+)/g)) {
    const name = m[1];
    if (defined.has(name) || ALLOW.some((a) => a.re.test(name))) continue;
    if (!missing.has(name)) missing.set(name, new Set());
    missing.get(name).add(rel);
  }
}

const rows = [...missing].sort((a, b) => b[1].size - a[1].size);

if (LIST) {
  for (const [name, users] of rows) {
    console.log(`   ${name}（${users.size} 箇所）`);
  }
  console.log(`   （${rows.length} 件）`);
  process.exit(0);
}
const limit = (() => {
  try { return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? 0; } catch { return rows.length; }
})();

if (SET) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "定義されていない CSS 変数の参照数(種類)。tokens.css に定義するか、参照をやめると減る。増やさないための歯止め。",
    limit: rows.length,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を更新しました(${rows.length})`);
  process.exit(0);
}

for (const [name, where] of rows) {
  console.log(`   ${String(where.size).padStart(3)} ファイル  ${name}  ← ${[...where][0]}`);
}

if (rows.length > limit) {
  console.error(`\n❌ 定義されていない CSS 変数の参照が ${rows.length} 種に増えました(上限 ${limit})`);
  console.error("   `packages/ui/src/styles/tokens.css` に定義してください。");
  console.error("   フォールバック付きでも**テーマが効かない**ことに変わりはありません。");
  process.exit(1);
}
console.log(`\n⚠ 定義されていない CSS 変数 ${rows.length} 種(上限 ${limit}・定義済み ${defined.size} 種)`);
console.log("   テーマを切り替えても変わりません(フォールバック付きなら壊れないだけ)。");
console.log("✅ 上限内です");
