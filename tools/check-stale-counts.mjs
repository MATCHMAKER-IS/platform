#!/usr/bin/env node
/**
 * **説明文に「すぐ古くなる数値」を固定で書いていないか**を見る。
 *
 * 【なぜ要るか】
 * `check-doc-numbers` は **`docs/` と `README` を見ます**が、
 * **`tools/` や `packages/` のコメントは見ていません**。
 *
 * コメントの数値は、**誰も直しません**。2026-08 に見つけた例:
 *
 * | 場所 | 書いてあった値 | 実際 |
 * |---|---|---|
 * | `gen-smoke-index.mjs` | 20,620 行・465 セクション | **24,549 行・399 セクション** |
 * | `gen-all.mjs` | 同上 | 同上 |
 * | `suggest.mjs` | 119 個 | **120 個** |
 *
 * **古い数値は、読む人の判断を狂わせます。**
 * このリポジトリは資料を AI が読む前提なので、
 * 「465 セクション」と書いてあれば**そう信じて作業されます**。
 *
 * 【何を見るか】
 * コメントの中の、**リポジトリの規模を指す数値**:
 *
 * - `N 行` / `N セクション` / `N パッケージ` / `N 個` / `N 本の検査`
 *
 * **すべての数値を禁じるわけではありません。** 変わらないもの
 * （`3 つの環境`・`5 回 / 分`・`1,000 件ずつ`・年号）は対象外です。
 * 見るのは**「数えれば分かる、そして増える」もの**だけ。
 *
 * 【どう書くか】
 * **数えた結果を出す側に書かせてください。**
 *
 * ```js
 * // ❌ smoke.mjs は 20,620 行・465 セクション
 * // ✅ smoke.mjs は 2 万行超（実数は docs/ai/smoke-index.md の冒頭）
 * ```
 *
 * 実行: node tools/check-stale-counts.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。 */
const DIRS = ["tools", "packages", "scripts"];

const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "generated", "coverage"]);

/**
 * **増えるものを数えた値**。ここに当たったら指摘する。
 *
 * 単位を絞っているのは、**変わらない数値まで拾わない**ため
 * （`5 回 / 分`・`3 つの環境`・`1,000 件ずつ` は正しい記述）。
 */
const STALE = [
  { re: /\*\*[\d,]{3,}\s*行/, what: "行数" },
  { re: /[\d,]{2,}\s*セクション/, what: "セクション数" },
  { re: /[\d,]{2,}\s*パッケージ/, what: "パッケージ数" },
  { re: /[\d,]{2,}\s*本の検査/, what: "検査の本数" },
  { re: /検査\s*[\d,]{2,}\s*(件|本|種類)/, what: "検査の本数" },
  { re: /[\d,]{3,}\s*件の検査/, what: "検査の件数" },
];

/**
 * 見逃してよいもの。**理由を必ず書く。**
 */
const ALLOW = [
  {
    re: /^tools\/check-stale-counts\.mjs$/,
    why: "この検査自身。説明に「書いてはいけない例」が出てくる",
  },
  {
    re: /^tools\/gen-smoke-index\.mjs$/,
    line: /24,549 行・399 セクション/,
    why: "**過去にこう書いてあった**という記録(なぜ固定値を書かなくなったかの説明)",
  },
];

function allowed(rel, line) {
  return ALLOW.some((a) => a.re.test(rel) && (a.line === undefined || a.line.test(line)));
}

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    else if (/\.(ts|tsx|mjs|mts|js)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));
const found = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    // **コメントだけを見る。** コードの中の数値（`limit: 60`）は設定であって説明ではない
    if (!/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (allowed(rel, line)) continue;

    // **「その時点の記録」は残すべきもの。**
    // 「2026-08 の時点で 12 パッケージが…」「それまでは 13 パッケージが未検査だった」は
    // **なぜそうしたかの説明**で、いま何個かとは関係ない——直すと経緯が消える。
    // 見たいのは**現在形の断定**(「N パッケージある」)だけ。
    if (/\d{4}-\d{2}|それまでは|当時|かつて|以前は|と書いてありました|残っていた|だった|していた|いた\)/.test(line)) continue;
    // 「〜すると」「〜なら」のような仮定も、規模の説明ではない
    if (/だと|あると|すると|なのに|超えると/.test(line)) continue;
    // **「〜のような」は例示。** 実際の値ではないので直しようがない
    if (/」のような|」という古い|例:/.test(line)) continue;
    // **「N 行の正しいデータ」のような、対象データの説明は規模ではない**
    // (`997 行の CSV` はリポジトリの大きさとは無関係)
    if (/行の(正しい|データ|CSV)|件のデータ/.test(line)) continue;
    // 過去の調査結果を番号付きで残しているもの(「発見3: 34パッケージが…」)
    if (/発見\d|^\s*\/\/\s+\d\.\s/.test(line)) continue;
    for (const s of STALE) {
      if (!s.re.test(line)) continue;
      found.push({ where: `${rel}:${i + 1}`, what: s.what, text: line.trim().slice(0, 70) });
      break;
    }
  }
}

if (found.length === 0) {
  console.log(`✅ 説明文に古くなる数値はありません(${files.length} ファイルを検査 / ${DIRS.join(", ")})`);
  process.exit(0);
}

console.error(`❌ 説明文に「すぐ古くなる数値」が ${found.length} 件あります(${files.length} ファイルを検査):`);
for (const f of found) {
  console.error(`   ${f.where}(${f.what}): ${f.text}`);
}
console.error("");
console.error("   **コメントの数値は、誰も直しません。**");
console.error("   このリポジトリは資料を AI が読む前提なので、**古い数値はそのまま信じられます**。");
console.error("");
console.error("   数えた結果は、**出す側に書かせてください**:");
console.error("     ❌ smoke.mjs は 20,620 行・465 セクション");
console.error("     ✅ smoke.mjs は 2 万行超（実数は docs/ai/smoke-index.md の冒頭）");
process.exit(1);
