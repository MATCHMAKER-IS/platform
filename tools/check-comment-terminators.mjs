#!/usr/bin/env node
/**
 * **ブロックコメントが途中で終わっていないか**を見る。
 *
 * 【何が起きるか】
 * 説明のためにグロブや JSX をコメント内へ書くと、
 * その中の「アスタリスク＋スラッシュ」が**コメントをそこで終わらせる**。
 * 以降は**コードとして解釈される**ので、
 * `Unterminated string literal` や `ReferenceError: src is not defined` になる。
 *
 * よく踏む書き方(いずれも 2026-08 に実際に踏んだ):
 *
 * - パッケージ配下を表そうとして `packages` のあとにアスタリスクとスラッシュを続けた
 * - JSX の例を `\{/* … *\/\}` の形でそのまま貼った
 * - 全階層を表す二重アスタリスクのあとにスラッシュを書いた
 *
 * **エラーの文面が原因とかけ離れる**のが厄介で、
 * 「なぜ `src` が未定義なのか」を探して時間を溶かす。
 *
 * 【なぜ検査にするか】
 * `check-test-setup` が同じ判定を持っていたが、**`vitest.workspace.ts` 1 本だけ**を
 * 見ていた。実際には `tools/` の検査でも設定ファイルでも起きる——
 * 2026-08、**同じ間違いを 2 度**踏んだ(`check-async-boundary` と
 * `check-coverage-scope` の説明文)。**1 ファイル限定の検査は、その外を守らない。**
 *
 * 【判定】
 * コメント行(行頭がアスタリスク)の**途中**に終端があり、**次の行もコメント行**なら誤り。
 * 「文章のあとに終端を置いて閉じる」書き方(次の行はコードになる)は正しいので見逃す。
 *
 * 実行: node tools/check-comment-terminators.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。 */
const DIRS = ["tools", "packages", "apps", "scripts"];

/** ルート直下も見る(設定ファイルで踏みやすい)。 */
const ROOT_FILES = ["vitest.config.ts", "vitest.workspace.ts", "eslint.config.mjs", "turbo.json"];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "generated", ".git"]);

const TERMINATOR = "*" + "/";

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = [
  ...DIRS.flatMap((d) => collect(path.join(ROOT, d))),
  ...ROOT_FILES.map((f) => path.join(ROOT, f)).filter((f) => existsSync(f)),
];

const offenders = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    // コメントの継続行(行頭がアスタリスク)だけを見る
    if (!/^\s*\*\s/.test(line)) continue;
    if (!line.includes(TERMINATOR)) continue;
    // 終端だけの行(正しい閉じ方)は対象外
    if (/^\s*\*\/\s*$/.test(line)) continue;
    // **次の行もコメント行なら、書き手はまだ続けるつもりだった**
    const next = lines[i + 1] ?? "";
    if (!/^\s*\*/.test(next)) continue;
    offenders.push({ where: `${rel}:${i + 1}`, text: line.trim().slice(0, 70) });
  }
}

if (offenders.length === 0) {
  console.log(`✅ ブロックコメントは途中で終わっていません(${files.length} ファイルを検査)`);
  process.exit(0);
}

console.error(`❌ ブロックコメントが途中で終わっています(${offenders.length} 件 / ${files.length} ファイルを検査):`);
for (const o of offenders) console.error(`   ${o.where}: ${o.text}`);
console.error("");
console.error("   **この行でコメントが終わり、以降はコードとして解釈されます。**");
console.error("   エラーの文面は原因とかけ離れます(`ReferenceError: src is not defined` など)。");
console.error("   グロブや JSX は**文章で説明する**か、行頭のアスタリスクを外した別の書き方にしてください。");
process.exit(1);
