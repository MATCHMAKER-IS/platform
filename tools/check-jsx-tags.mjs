/**
 * apps/ と demos/ の .tsx を対象に、**next build を落とす JSX 構文エラー**のうち
 * オフラインで機械的に捕まえられる 2 種を検査する:
 *
 *  1. インライン要素の**開閉数の不一致**(FAIL)
 *     `<strong>` を閉じ忘れると Turbopack が「閉じタグが来るはずが本文が来た」で落ちる
 *     (実例: demos/showcase barcode の `Expected '</', got 'jsx text'`)。
 *  2. JSX テキストに紛れ込んだ **markdown の `**`**(WARN)
 *     `**強調**` の書き損じ。多くは表示崩れ(ビルドは止めない)なので警告に留める。
 *
 * なぜ preflight に要るか: 型チェック(tsc)は JSX 構文も見るが、node_modules と型定義が
 * 要る。preflight は依存ゼロで回るゲートなので、この手のエラーは従来すり抜けていた。
 * 本チェックは正規表現ヒューリスティックで、tsc の代替ではなく**早期の一次検知**が目的。
 *
 *   node tools/check-jsx-tags.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// 明示的な閉じが必須で、実務上 self-close しないインライン要素。
// これらの開閉がずれると JSX の構文が壊れる。
const TAGS = [
  "strong", "em", "b", "i", "code", "kbd", "mark",
  "small", "sub", "sup", "u", "del", "ins", "abbr", "cite",
];

/** node_modules 等を除いて .tsx を集める。 */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "dist" || e.name === ".turbo") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/** コメントを落とす(タグ計数・** 判定の誤検知源になるため)。文字列は残す。 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // ブロックコメント
    .replace(/([^:])\/\/[^\n]*/g, "$1"); // 行コメント(URL の :// を避け、直前が : でないもの)
}

const files = walk(path.join(ROOT, "apps")).concat(walk(path.join(ROOT, "demos")));

let errors = 0;
let warnings = 0;

for (const f of files) {
  const src = stripComments(fs.readFileSync(f, "utf8"));
  const rel = path.relative(ROOT, f);

  // 1) インラインタグの開閉均衡(FAIL)
  for (const tag of TAGS) {
    // 開き: `<tag` の直後が語境界。self-close(`<tag ... />`)は除外。属性・改行に強い。
    const opens = (src.match(new RegExp(`<${tag}\\b(?![^>]*/>)`, "g")) || []).length;
    const closes = (src.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (opens !== closes) {
      errors += 1;
      console.error(
        `❌ ${rel}: <${tag}> の開閉が不一致(開=${opens} 閉=${closes})。閉じ忘れは next build を構文エラーで落とします`,
      );
    }
  }

  // 2) JSX テキスト中の markdown `**`(WARN)
  src.split("\n").forEach((line, i) => {
    // タグ閉じ(英数/"/} の直後の >)から、< も { も挟まずに ** が出るケース、または行頭の **。
    const inJsxText = /[A-Za-z0-9"'}]>[^<{]*\*\*/.test(line) || /^\s*\*\*\S/.test(line);
    const literalInCode = /<code>[^<]*\*\*/.test(line); // `<code>**</code>`(** を表示している)は正当
    const exponent = /\w\s\*\*\s\w/.test(line); // `a ** b`(指数)は除外
    if (inJsxText && !literalInCode && !exponent) {
      warnings += 1;
      console.error(`⚠️  ${rel}:${i + 1}: JSX テキストに markdown の ** が混入している可能性(<strong> の書き忘れ)`);
    }
  });
}

if (errors > 0) {
  console.error(`\n❌ JSX タグの開閉不一致が ${errors} 件。next build の前に修正してください`);
  process.exitCode = 1;
} else {
  const warn = warnings > 0 ? ` / ⚠️ ${warnings} 件の ** 混入疑い` : "";
  console.log(`✅ JSX インラインタグの開閉は均衡(${files.length} ファイル検査)${warn}`);
}
