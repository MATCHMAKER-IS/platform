/**
 * 公開 API の TSDoc(@param / @returns / @throws)の網羅性を検査する。
 *   node tools/check-tsdoc.mjs            … 一覧(警告のみ)
 *   node tools/check-tsdoc.mjs --strict   … 不足があれば exit 1
 *   node tools/check-tsdoc.mjs <package>  … 1 パッケージだけ詳しく
 *
 * **なぜ必要か**: 型だけでは「この引数に何を渡すのか」「何が返るのか」「いつ例外が出るのか」が
 * 分からない。エディタの補完に説明が出ないと、使う人は実装を読みに行くことになる。
 * AI も同じで、TSDoc が無いと誤った使い方を提案する。
 *
 * **既知の限界**: 正規表現ベースのため、`export const foo = () => {}`(アロー関数)や
 * オーバーロード宣言は拾えない。ジェネリクス・複数行シグネチャ・デフォルト引数には対応済み。
 * 完全な解析には TypeScript Compiler API が要るが、install が必要になるため見送っている。
 *
 * **一括処理の注意**: 正規表現で TSDoc を機械的に足すと、**別の関数の説明が混入したり、
 * 関数本体ごと消える**ことがある(実際に sortBy を壊しかけた)。
 * 「(説明を書く)」のような雛形だけ入れるのも有害(TSDoc があるように見えて中身が無い)。
 * **1 ファイルずつ、意味を確認しながら書く**こと。急がば回れ。
 *
 * **判定の方針**: すべての関数に全タグを求めない。
 * - 引数があるのに `@param` が無い → 要改善
 * - `void`/`Promise<void>` 以外を返すのに `@returns` が無い → 要改善
 * - `throw` するのに `@throws` が無い → 要改善
 * - 説明文が全く無い → 要改善(最優先)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * 関数 1 件の診断結果。
 * @typedef {object} FnDoc
 * @property {string} pkg      パッケージ名
 * @property {string} file     ファイル(リポジトリ相対)
 * @property {string} name     関数名
 * @property {boolean} hasSummary   説明文(タグ以外の本文)があるか
 * @property {boolean} hasArgs      引数があるか
 * @property {boolean} hasParam     @param があるか
 * @property {boolean} returnsValue 戻り値が void 以外か
 * @property {boolean} hasReturns   @returns があるか
 * @property {boolean} throws       本体で throw しているか
 * @property {boolean} hasThrows    @throws があるか
 */

/**
 * 不足しているタグの一覧を返す。
 * @param {FnDoc} fn 診断結果
 * @returns {string[]} 不足の名前(空なら完備)
 */
export function missingOf(fn) {
  const miss = [];
  if (!fn.hasSummary) miss.push("説明文");
  if (fn.hasArgs && !fn.hasParam) miss.push("@param");
  if (fn.returnsValue && !fn.hasReturns) miss.push("@returns");
  if (fn.throws && !fn.hasThrows) miss.push("@throws");
  return miss;
}

/** ソースから export function を拾い、直前の TSDoc を解析する。 */
function analyzeFile(pkg, file) {
  const src = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  const out = [];

  // /** ... */ の直後の export function を対象にする(コメントが無いものも拾う)。
  // 引数は複数行・ネストした括弧(デフォルト引数の `new Date()` など)を含むため、
  // [^)]* では途中で切れる。[\s\S]*? で最短一致させ、`) :` または `) {` で閉じる。
  const re = /(\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*(?::\s*([^{;]+?))?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const doc = m[1] ?? "";
    const name = m[2] ?? "";
    const args = (m[3] ?? "").trim();
    const ret = (m[4] ?? "").trim();
    // 本体を粗く切り出して throw の有無を見る(次の export か末尾まで)
    const bodyStart = m.index + m[0].length;
    const nextExport = src.indexOf("\nexport ", bodyStart);
    const body = src.slice(bodyStart, nextExport === -1 ? src.length : nextExport);

    // 説明文 = タグ以外の本文があるか
    const summary = doc
      .replace(/\/\*\*|\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l && !l.startsWith("@"))
      .join(" ");

    out.push({
      pkg,
      file: rel,
      name,
      hasSummary: summary.length > 0,
      hasArgs: args.length > 0,
      hasParam: doc.includes("@param"),
      returnsValue: ret !== "" && !/^(void|Promise<void>)$/.test(ret),
      hasReturns: doc.includes("@returns"),
      throws: /\bthrow\s+new\b/.test(body),
      hasThrows: doc.includes("@throws"),
    });
  }
  return out;
}

/** 全パッケージを診断する。 */
export function analyze(only) {
  const pkgDir = path.join(ROOT, "packages");
  const results = [];
  for (const pkg of readdirSync(pkgDir)) {
    if (only && pkg !== only) continue;
    const srcDir = path.join(pkgDir, pkg, "src");
    if (!existsSync(srcDir)) continue;
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.ts$/.test(e.name) && !e.name.includes(".test.")) results.push(...analyzeFile(pkg, p));
      }
    };
    walk(srcDir);
  }
  return results;
}

/** パッケージ別の集計。 */
export function summarize(fns) {
  const byPkg = new Map();
  for (const fn of fns) {
    const cur = byPkg.get(fn.pkg) ?? { total: 0, complete: 0, missing: 0 };
    cur.total += 1;
    if (missingOf(fn).length === 0) cur.complete += 1;
    else cur.missing += 1;
    byPkg.set(fn.pkg, cur);
  }
  return [...byPkg.entries()]
    .map(([pkg, v]) => ({ pkg, ...v, rate: v.total === 0 ? 1 : v.complete / v.total }))
    .sort((a, b) => a.rate - b.rate || b.total - a.total);
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const only = args.find((a) => !a.startsWith("--"));

  const fns = analyze(only);
  const incomplete = fns.filter((f) => missingOf(f).length > 0);

  if (only) {
    console.log(`${only}: ${fns.length} 関数 / 不足 ${incomplete.length}`);
    for (const f of incomplete) {
      console.log(`  ${f.name}(${f.file.split("/").pop()}): ${missingOf(f).join(", ")} が不足`);
    }
    return;
  }

  const rows = summarize(fns);
  const total = fns.length;
  const complete = total - incomplete.length;
  console.log(`公開関数 ${total} / TSDoc 完備 ${complete}(${Math.round((complete / total) * 100)}%)\n`);
  console.log("改善が必要な上位(完備率の低い順):");
  for (const r of rows.slice(0, 15)) {
    if (r.rate === 1) continue;
    console.log(`  ${String(Math.round(r.rate * 100)).padStart(3)}%  ${r.pkg.padEnd(16)} ${r.complete}/${r.total}`);
  }
  console.log(`\n詳細: node tools/check-tsdoc.mjs <パッケージ名>`);

  if (strict && incomplete.length > 0) {
    console.error(`\n❌ ${incomplete.length} 件の TSDoc が不足しています`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
