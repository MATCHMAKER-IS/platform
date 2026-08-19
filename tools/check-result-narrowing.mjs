/**
 * **Result 型の絞り込みが効かない書き方**を検出する。
 *   node tools/check-result-narrowing.mjs
 *
 * 【なぜ必要か】
 * この基盤は失敗を `Result<T>`(`{ ok: true, value }` または `{ ok: false, error }`)で
 * 返す。値を取り出すには `ok` を確かめて絞り込むが、
 * **同じ呼び出しを 2 回書くと絞り込みが効かない**。
 *
 *     // ❌ 別の式なので、1 回目の ok チェックが 2 回目に効かない
 *     expect((await s.exists("x")).ok && (await s.exists("x")).value).toBe(false);
 *     //                                                    ^^^^^ TS2339
 *
 *     // ✅ 一度変数に受ける
 *     const r = await s.exists("x");
 *     expect(r.ok && r.value).toBe(false);
 *
 * TypeScript の型絞り込みは「同じ参照」に対してしか働かない。
 * 2 回呼べば**別の値**なので、`Err` の可能性が残ったままになる。
 *
 * **`tsc` でしか出ない**(vitest は型を見ない)ため、テストが全部緑でもビルドが落ちる。
 * 2026-07 に `@platform/testing` の契約テストで踏んだ。
 * 同じファイルの他の箇所は正しく変数に受けており、1 箇所だけ逸れていた。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * 同じ呼び出しを 2 回書いて絞り込もうとしている形。
 *
 * `(await f(...)).ok && (await f(...)).value` や `f().ok && f().value` を拾う。
 * 呼び出し名が一致しているものだけを対象にして、誤検知を抑える。
 */
const PATTERNS = [
  // (await x.f(...)).ok && (await x.f(...)).value
  /\(await\s+([\w.]+)\(.*?\)\)\.ok\s*&&\s*\(await\s+([\w.]+)\(.*?\)\)\.(?:value|error)/,
  // x.f(...).ok && x.f(...).value
  // **`.ok` の直前の呼び出し名を取る。** `expect(` のような外側の呼び出しを拾わないよう、
  // 名前と `(` の間に別の `(` が来ない形に限定する。
  /([\w.]+)\([^(]*?\)\.ok\s*&&\s*([\w.]+)\([^(]*?\)\.(?:value|error)/,
];

const problems = [];
const files = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx"] });

for (const rel of files) {
  const lines = readFileSync(path.join(ROOT, rel), "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // 注意書きは対象外
    for (const re of PATTERNS) {
      const m = re.exec(line);
      // 呼び出し先が同じときだけ「2 回呼んでいる」と判定する
      if (m && m[1] === m[2]) {
        problems.push({ rel, line: i + 1, call: m[1], text: line.trim().slice(0, 80) });
        break;
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    `❌ Result の絞り込みが効かない書き方が ${problems.length} 件あります。` +
    "\n   同じ呼び出しを 2 回書くと**別の式**になり、`ok` の絞り込みが効きません(TS2339)。",
  );
  for (const p of problems) {
    console.error(`   ${p.rel}:${p.line}  ${p.call}() を 2 回呼んでいます`);
    console.error(`     ${p.text}`);
  }
  console.error(
    "\n   直し方: 一度変数に受けてから絞り込む" +
    "\n     const r = await s.exists(\"x\");" +
    "\n     expect(r.ok && r.value).toBe(false);",
  );
  process.exitCode = 1;
} else {
  console.log(`✅ Result の絞り込みは正しく書かれています(${files.length} ファイルを検査)`);
}
