#!/usr/bin/env node
/**
 * **検査ツールの除外リストに、静かに上書きされている項目が無いかを確かめる。**
 *
 * 【なぜ要るか】
 * 除外リストはオブジェクトで書くことが多い:
 *
 * ```js
 * const ALLOW = {
 *   "検証": "文脈ごとに異なる",
 *   …
 *   "検証": "同上",          // ← 後がち。上の理由は消える
 * };
 * ```
 *
 * JavaScript は同じキーを 2 回書いてもエラーにしない。**後の値が静かに勝つ**。
 * 動きは変わらないので誰も気づかないが、**先に書いた理由が消える**。
 * 除外の理由が消えると、次の人は「なぜこれを許しているのか」を調べ直すことになり、
 * 分からなければ外してしまう(すると本物の指摘が復活して混乱する)。
 *
 * 2026-08 に `check-docs-duplication.mjs` の `ALLOW` で 1 件見つかった。
 *
 * 【なぜ lint で足りないか】
 * ESLint の `no-dupe-keys` は対象だが、`tools/` は
 * `eslint.config.mjs` の対象から外れている(検査ツールは違反の形を
 * 文字列で持つのが仕事で、通常の規約を当てるとかえって邪魔になるため)。
 * 除外リストの健全性だけは見ておきたいので、ここで見る。
 *
 * 実行: node tools/check-allow-lists.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = path.join(ROOT, "tools");

const issues = [];
let checkedLists = 0;

for (const file of readdirSync(TOOLS).filter((f) => f.endsWith(".mjs"))) {
  const src = readFileSync(path.join(TOOLS, file), "utf8");
  // `const XXX = {` … `\n};` の形をひとまとまりとして見る
  for (const m of src.matchAll(/^const (\w+)\s*=\s*\{$/gm)) {
    const start = m.index;
    const end = src.indexOf("\n};", start);
    if (end < 0) continue;
    checkedLists += 1;
    const body = src.slice(start, end);
    const keys = [...body.matchAll(/^\s{2}"([^"]+)":/gm)].map((k) => k[1]);
    const seen = new Set();
    const dup = new Set();
    for (const k of keys) {
      if (seen.has(k)) dup.add(k);
      seen.add(k);
    }
    for (const d of dup) {
      const line = src.slice(0, start).split("\n").length;
      issues.push(`tools/${file}:${line} の ${m[1]}: キー "${d}" が 2 回あります(後の値が静かに勝ち、先に書いた理由が消えます)`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 除外リストに重複はありません(${checkedLists} 個のリストを検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**動きは変わらないので気づけません。**`);
console.error("理由を 1 つにまとめてください(消えた側の理由も残すこと)。");
process.exit(1);
