#!/usr/bin/env node
/**
 * **TSDoc の `@example` を実行して、書いてある期待値と合うかを確かめる。**
 *
 * 【なぜ要るか】
 * この基盤では **TSDoc が実装より多くを約束する**形が繰り返し出た:
 *
 *  - `formatWareki` … 「令和8年**7月15日**形式」と書いて、実装は年で終わっていた
 *  - `normalizeZipcode` … 「**7 桁に正規化**する」と書いて、桁を検証していなかった
 *  - `stepUpRequired` … 説明は `maxAgeMs`(ミリ秒)、実装は `freshnessSec`(秒)
 *  - `nowOffset` … 同じ説明の中で「0..1」と「(%)」が矛盾していた
 *
 * `check-tsdoc-params` は**引数名**を突き合わせるが、
 * **戻り値が説明どおりかは誰も見ていない**。`@example` に
 * `formatWareki(d); // "令和8年7月15日"` と書いてあれば、
 * 実行して比べるだけで食い違いが分かる。
 *
 * 【何を対象にするか】
 * `式; // 期待値` の形で、期待値が**そのまま比較できるもの**だけ。
 * 真偽値・数値・文字列リテラルが対象で、`// 更新した配列` のような
 * 説明文は飛ばす(比べようがない)。
 *
 * **引数に変数を使う例も飛ばす**(`can(policy, ...)` の `policy` は
 * その場に無い)。読み込んだモジュールの関数だけで完結する式が対象。
 *
 * 実行:
 *   node --experimental-strip-types tools/check-doc-examples.mjs
 *   node --experimental-strip-types tools/check-doc-examples.mjs --list
 */
import { register } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = process.argv.includes("--list");

// **拡張子なしの相対 import(`./rbac`)を解決する。**
// この基盤の標準的な書き方(481 ファイル)だが、Node で直接読むと落ちる。
// 無いと「同じパッケージ内で分割されているだけ」のファイルが検証対象から漏れる。
register("./lib/ts-resolve-loader.mjs", import.meta.url);
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/** `式; // 期待値` を拾う。期待値は行頭から見て比較できる形だけ。 */
const EXAMPLE = /^\s*\*\s*(\w+\(.*?\));?\s*\/\/\s*(.+)$/gm;
/**
 * そのまま比較できる期待値(真偽値・数値・文字列)。
 *
 * **数値は行末まで数字であること**を要求する。そうしないと
 * `// 2026-07-29T00:00:00Z`(Date の説明)を数値 `2026` と読んでしまう
 * (最初の実装でこれを誤検出した)。
 */
const COMPARABLE = /^(true|false|-?\d+(?:\.\d+)?\s*$|"[^"]*")/;

function collect(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (/\.ts$/.test(p) && !/\.test\./.test(p)) acc.push(p);
  }
  return acc;
}

const issues = [];
let checked = 0;
let skipped = 0;
/** 依存が解決できず読めなかった数(環境によって変わる)。 */
let unreadable = 0;

for (const file of collect(path.join(ROOT, "packages"))) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const src = readFileSync(file, "utf8");
  const found = [...src.matchAll(EXAMPLE)];
  if (found.length === 0) continue;

  /** @type {Record<string, unknown> | null} */
  let mod = null;
  for (const m of found) {
    const [expr, rawExpected] = [m[1], m[2].trim()];
    if (!COMPARABLE.test(rawExpected)) { skipped += 1; continue; }
    const fnName = expr.slice(0, expr.indexOf("("));
    // **入れ子の呼び出しは飛ばす。** `toHiragana(toFullWidthKana("ﾔﾏﾀﾞ"))` は
    // 内側の関数もその場に要る。1 つの関数だけを確かめる作りにしている
    if (/\w+\s*\(/.test(expr.slice(expr.indexOf("(") + 1))) { skipped += 1; continue; }
    // **引数に識別子(変数)を含む式は飛ばす。** その場に無いものは呼べない
    const args = expr.slice(expr.indexOf("(") + 1, expr.lastIndexOf(")"));
    if (/[A-Za-z_$][\w$]*\s*(,|$|\))/.test(args.replace(/"[^"]*"|'[^']*'|new Date\([^)]*\)|true|false|null|undefined/g, ""))) {
      skipped += 1;
      continue;
    }

    if (mod === null) {
      try {
        mod = await import(pathToFileURL(file).href);
      } catch {
        // **読み込めないものは飛ばす。** ワークスペースの解決には
        // node_modules が要り、環境によっては無い(誤検出より漏れを選ぶ)
        skipped += found.length;
        unreadable += found.length;
        break;
      }
    }
    const fn = mod?.[fnName];
    if (typeof fn !== "function") { skipped += 1; continue; }

    checked += 1;
    let actual;
    try {
      // eslint-disable-next-line no-eval
      actual = eval(`(${expr.replace(fnName, "fn")})`);
    } catch (e) {
      issues.push(`${rel}: ${expr} が実行できません(${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const expected = rawExpected.match(COMPARABLE)?.[0] ?? "";
    const actualLiteral = typeof actual === "string" ? JSON.stringify(actual) : String(actual);
    if (actualLiteral !== expected) {
      issues.push(`${rel}: ${expr}\n      説明: ${expected}\n      実際: ${actualLiteral}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ TSDoc の例は実装と一致しています(${checked} 件を実行 / ${skipped} 件は比較対象外)`);
  // **対象外の内訳を出す。** 「11 件しか見ていない」ことに気づけるようにする。
  // `pnpm install` 済みの環境では基盤間依存を持つパッケージも読めるので、
  // 実行できる件数が増える(この数字は環境によって変わる)
  if (unreadable > 0) {
    console.log(`   うち ${unreadable} 件は依存を解決できず未実行(pnpm install 済みの環境では実行されます)`);
  }
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**説明が実装と違います。**`);
console.error("読む人は例を信じて使うので、実装か説明のどちらかを直してください。");
process.exit(1);
