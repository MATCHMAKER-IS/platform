/**
 * **`@returns` の説明と実装の食い違い**を検出する。
 *
 * 【なぜ見張るか】
 * 「無ければ `undefined`」と書いてあるのに `null` を返す関数があると、
 * **呼び出し側の `=== undefined` が常に false** になる:
 *
 * ```ts
 * const w = toWareki(d);
 * if (w === undefined) return "西暦";  // ← 通らない
 * console.log(w.era);                  // ← null.era で落ちる
 * ```
 *
 * 型検査は `| null` を見て気づくが、**説明を読んで書いた人**は
 * `undefined` で判定する。**型注釈より説明を信じる**のが人の自然な読み方で、
 * そこがずれていると事故になる。
 *
 * 2026-08 に 5 件見つかった(`toWareki` / `rangeIntersection` /
 * `parseTraceparent` / `getParam` / `currentStep`)。
 * **説明を実装に合わせた**——実装を変えると呼び出し側が壊れるため。
 *
 * 【判定の方法】
 * `@returns` の文に `undefined` があり、実装に `return null;` があって
 * 説明に `null` が出てこない場合(逆も)を拾う。**構文解析はしない**ので
 * 見落としはあるが、**最も多い形**は捕まえられる。
 *
 * 使い方:
 * ```
 * node tools/check-returns-mismatch.mjs
 * node tools/check-returns-mismatch.mjs --list
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docBefore, stripComments } from "./lib/source-text.mjs";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 食い違いを探す。 */
function findMismatches() {
  const hits = [];
  for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts", ".tsx"] })) {
    if (/\.test\.tsx?$/.test(rel)) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const code = stripComments(src);
    // **関数の本体を大まかに取る**(600 文字まで。長い関数は先頭だけ見る)
    for (const m of code.matchAll(/^export function (\w+)[\s\S]{0,8000}?\n\}/gm)) {
      const body = m[0];
      const doc = docBefore(src, m.index ?? 0);
      const returns = /@returns([^\n@]*(?:\n \* [^\n@]*)*)/.exec(doc)?.[1] ?? "";
      if (returns === "") continue;

      const saysUndefined = /undefined/.test(returns);
      const saysNull = /\bnull\b/.test(returns);
      // **トップレベルの `return` だけを見る。** 上限を 600 → 8000 に広げたら、
      // **内部の即時関数や `catch` の中の `return`** まで拾うようになった
      // （2026-08。`tunnelConfigFromEnv` が誤検出された）。
      // インデント 2 スペースのものが**関数自身の戻り値**です。
      const returnsUndefined = /\n  return undefined;/.test(body);
      const returnsNull = /\n  return null;/.test(body);

      if (saysUndefined && returnsNull && !saysNull) {
        hits.push({ file: rel.replace(/\\/g, "/"), name: m[1], why: "説明は undefined だが null を返す" });
      }
      if (saysNull && returnsUndefined && !saysUndefined) {
        hits.push({ file: rel.replace(/\\/g, "/"), name: m[1], why: "説明は null だが undefined を返す" });
      }
    }
  }
  return hits;
}

/**
 * **`@throws` があるのに `throw` が無い**関数を探す。
 *
 * 「例外を投げる」と書いてあるのに `null` を返すと、
 * **`try/catch` で待ち構えても捕まらない**:
 *
 * ```ts
 * try {
 *   const sum = sumMoney(items);   // 例外を期待
 *   save(sum.amount);              // ← null.amount で落ちる
 * } catch { …通貨混在の処理… }      // ← ここに来ない
 * ```
 *
 * 2026-08 に 3 件直した(`addMoney` / `sumMoney` / `parseDate`)。
 * **残りは上限方式**——`throw` を含むヘルパーを呼んでいる場合など、
 * **投げるのに検出できない形**があり、一律に禁じられない。
 *
 * @returns 見つかった関数
 */
function findMissingThrows() {
  const hits = [];
  for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts", ".tsx"] })) {
    if (/\.test\.tsx?$/.test(rel)) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const code = stripComments(src);
    const lines = code.split("\n");
    for (const m of code.matchAll(/^export function (\w+)/gm)) {
      const doc = docBefore(src, m.index ?? 0);
      if (!/@throws/.test(doc)) continue;
      // **「なし」と明示しているものは対象外**
      if (/@throws\s+なし/.test(doc)) continue;
      // **「〜実行時」と書いてあるものは対象外。** 返した関数やコールバックの
      // 中で投げる形で、**この関数自身は投げない**のが正しい
      // (`createDiscordChannel` は「`send` 実行時」と明記している)。
      // 説明が正しいのに検出されるのは、**検査の側の誤り**(2026-08)
      if (/@throws[^\n]*実行時/.test(doc)) continue;
      // 関数の開始行から、次の `^export` までを本体とみなす
      const startLine = code.slice(0, m.index).split("\n").length - 1;
      let endLine = lines.length;
      for (let i = startLine + 1; i < lines.length; i += 1) {
        if (/^export /.test(lines[i] ?? "")) { endLine = i; break; }
      }
      const body = lines.slice(startLine, endLine).join("\n");
      // **`reject()` も例外と同じ**(Promise の失敗として呼び出し側の catch に届く)。
      // `withTimeout` は `reject(new Error(...))` を使っており、
      // **`throw` だけを探すと「投げない」と誤判定**していた(2026-08)
      if (!/\bthrow\b/.test(body) && !/\breject\(/.test(body)) {
        hits.push({ file: rel.replace(/\\/g, "/"), name: m[1] });
      }
    }
  }
  return hits;
}

const THROWS_LIMIT = 0;

const hits = findMismatches();
const throwHits = findMissingThrows();

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h.file}  ${h.name}  — ${h.why}`);
  if (throwHits.length > 0) {
    console.log("\n   ── @throws があるのに throw / reject が無い");
    for (const h of throwHits) console.log(`   ${h.file}  ${h.name}`);
  }
}

if (hits.length > 0) {
  console.error(`❌ @returns の説明と実装が食い違う箇所が ${hits.length} 件あります`);
  for (const h of hits.slice(0, 10)) console.error(`   ${h.file}  ${h.name}  — ${h.why}`);
  console.error("");
  console.error("**説明を実装に合わせてください**(実装を変えると呼び出し側が壊れます)。");
  console.error("「無ければ undefined」と書いてあるのに `null` を返すと、");
  console.error("**呼び出し側の `=== undefined` が常に false** になり、`null.x` で落ちます。");
  process.exit(1);
}

if (throwHits.length > THROWS_LIMIT) {
  console.error(`❌ @throws があるのに throw が無い関数が ${throwHits.length} 件に増えました(上限 ${THROWS_LIMIT})`);
  for (const h of throwHits.slice(0, 10)) console.error(`   ${h.file}  ${h.name}`);
  console.error("");
  console.error("**「例外を投げる」と書いてあるのに `null` を返すと、**");
  console.error("**`try/catch` で待ち構えても捕まりません**(`null.x` で落ちます)。");
  process.exit(1);
}

// **走査量を出す。** 出さないと `check-scan-reporting` が
// 「**対象を 1 件も見ていない**」と警告します——**何も見ていないのに緑**は
// 一番危ない状態で、2026-08 に実際そうなっていました。
const scanned = collectFiles(["packages"], ROOT, { extensions: [".ts", ".tsx"] })
  .filter((rel) => !/\.test\.tsx?$/.test(rel)).length;
console.log(`✅ @returns の説明と実装は一致しています(${scanned} ファイルを検査 / @throws の未実装は ${throwHits.length} 件 / 上限 ${THROWS_LIMIT})`);
