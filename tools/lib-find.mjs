#!/usr/bin/env node
/**
 * **検査ツールを書く前に、`tools/lib` に同じものが無いか調べる。**
 *
 * 【なぜ要るか】
 * `advisor` は `packages/*` の重複を見るが、**`tools/lib` は対象外**だった。
 * 検査ツールを書く人は既存の共通処理を見つけられず、同じものを書き直す。
 *
 * 2026-08 に実際に起きた。私(作業者)が作った検査 5 本のファイル収集が
 * **`collectFiles` と完全に同じ実装**で、しかも 5 本とも `.git` の除外を
 * 落としていた。この基盤の目的は「同じものを何度も作らない」ことなのに、
 * **検査を作る側がそれを破っていた**。
 *
 * 【使い方】
 * ```bash
 * node tools/lib-find.mjs ファイル 集める      # キーワードで探す
 * node tools/lib-find.mjs --list              # 全部出す
 * ```
 *
 * 判定は決定的でネットワーク不要。関数名・TSDoc の要約・引数名を見る。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docBefore, summaryOf } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, "tools", "lib");

/**
 * `tools/lib` の公開関数を集める。
 *
 * **TSDoc の 1 行目を要約として使う。** 説明が無い関数は名前だけで探すことになるが、
 * それは「説明を書く」で直すべきことなので、ここでは補わない。
 */
function collectExports() {
  const out = [];
  if (!existsSync(LIB)) return out;
  for (const file of readdirSync(LIB).filter((f) => /\.(mjs|mts)$/.test(f))) {
    const src = readFileSync(path.join(LIB, file), "utf8");
    // **直前の TSDoc だけを見る。** `@typedef` の説明ブロックが間に挟まると
    // 別の関数の要約を拾う(`collectFiles` が「走査の条件。」になっていた)
    for (const m of src.matchAll(/export (?:async )?(?:function|const) (\w+)/g)) {
      const name = m[1];
      // **共通処理を使う**(`tools/lib/source-text.mjs`)。
      // 直前のブロックを後ろから探す手順は 3 箇所で同じ誤りを踏んだ
      const block = docBefore(src, m.index);
      // **`@example` のコードや `@param` は要約に混ぜない。**
      // 混ぜると「const files = collectFiles(...)」のような行が要約になり、
      // 検索しても意味のある語が引っかからない(最初の実装でこれを踏んだ)
      const doc = summaryOf(block);
      out.push({ file, name, summary: doc.slice(0, 90) });
    }
  }
  return out;
}

const items = collectExports();
const args = process.argv.slice(2).filter((a) => a !== "--list");
const listAll = process.argv.includes("--list") || args.length === 0;

if (listAll) {
  console.log(`tools/lib の公開関数(${items.length} 個)\n`);
  let current = "";
  for (const it of items.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))) {
    if (it.file !== current) { current = it.file; console.log(`  ── ${it.file}`); }
    console.log(`     ${it.name.padEnd(24)} ${it.summary}`);
  }
  console.log("\n検査を書く前にここを見ること(同じものを 2 度書かない)。");
  process.exit(0);
}

// **語ごとに部分一致**。順序や助詞に依存させない
const hits = items.filter((it) => {
  // **キャメルケースを語に割る。** `collectFiles` を「collect」「files」でも引ける
  const words = it.name.replace(/([a-z])([A-Z])/g, "$1 $2");
  const hay = `${it.name} ${words} ${it.summary} ${it.file}`.toLowerCase();
  return args.every((a) => hay.includes(a.toLowerCase()));
});

if (hits.length === 0) {
  console.log(`「${args.join(" ")}」に一致する共通処理はありません(新規作成の候補)。`);
  console.log("全部見るなら: node tools/lib-find.mjs --list");
  process.exit(0);
}
console.log(`「${args.join(" ")}」に一致する共通処理(${hits.length} 件)\n`);
for (const h of hits) console.log(`  ${h.name.padEnd(24)} ${h.file}\n     ${h.summary}`);
console.log("\n**同じことをするなら書き直さず、これを使うこと。**");
