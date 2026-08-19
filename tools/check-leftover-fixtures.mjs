#!/usr/bin/env node
/**
 * **検証用の一時ファイルが残っていないかを確かめる。**
 *
 * 【なぜ要るか】
 * `verify-checks` は「違反を置くと赤くなるか」を確かめるツールなので、
 * **わざと壊れたファイルを一時的に置く**。途中で止まる(タイムアウト・中断)と
 * それが残り、**原因と無関係な検査が落ちる**。
 *
 * 2026-08 に 2 回起きた:
 *  - `core` と `crud-template` に置いたファイルが残り、
 *    `@platform/core: TSDoc 完備` が落ちた(説明の無い関数があるため)
 *  - `tools/` に置いた検証用の検査が残り、
 *    `check-preflight-coverage` が落ちたうえ、**資料の「検査 N 種類」まで狂った**
 *
 * どちらも**エラーの内容から原因に辿り着けない**。
 * 「core の TSDoc が落ちた」と言われて、まさか別ツールの残骸だとは思わない。
 *
 * 【`verify-checks` の掃除で足りない理由】
 * あちらが掃除するのは `CASES` に載っているファイルだけ。
 * **人が手で置いた検証用ファイル**(発火するか試したとき等)は対象外で、
 * 実際 2 回目はこの形だった。名前の規則で拾う方が漏れない。
 *
 * **このファイル名に `check-verify-` を使わない。** 自分自身を残骸として検出する
 * (最初 `check-verify-leftovers.mjs` と名付けて実際に起きた)。
 *
 * 実行: node tools/check-leftover-fixtures.mjs
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage"]);

/**
 * 検証用と分かる名前。
 *
 * **`verify-checks` が置く名前と揃えること。** 片方だけ変えると素通りする。
 */
const LEFTOVER = /__verify|check-verify-|__verify__/;

function collect(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (LEFTOVER.test(e.name)) { acc.push(p); continue; }
    if (e.isDirectory()) collect(p, acc);
  }
  return acc;
}

const found = [
  ...collect(path.join(ROOT, "packages")),
  ...collect(path.join(ROOT, "apps")),
  ...collect(path.join(ROOT, "tools")),
  ...collect(path.join(ROOT, "docs")),
];

const scanned = ["packages", "apps", "tools", "docs"].length;

if (found.length === 0) {
  console.log(`✅ 検証用の一時ファイルは残っていません(${scanned} ディレクトリを検査)`);
  process.exit(0);
}
for (const f of found) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  console.error(`❌ ${rel}${statSync(f).isDirectory() ? "(ディレクトリ)" : ""}`);
}
console.error(`\n${found.length} 件。**verify-checks が途中で止まった残骸です。**`);
console.error("放置すると、原因と無関係な検査が落ちます");
console.error("(TSDoc の完備・資料の「検査 N 種類」など、エラーから原因に辿り着けません)。");
console.error("削除してから、資料の数値を `node tools/check-doc-numbers.mjs --fix` で直してください。");
process.exit(1);
