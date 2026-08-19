/**
 * **一覧の並び順が指定されているか**を見張る。
 *
 * 【なぜ見張るか】
 * `findMany` に `orderBy` が無いと、**DB が返す順は不定**。
 * PostgreSQL は物理的な格納順で返すので、**行を更新すると順序が変わる**
 * (更新した行が末尾へ移動することがある)。
 *
 * 画面には次の形で現れる:
 *
 * - 一覧を開くたびに**並びが違う**
 * - 更新した行が**別の場所へ飛ぶ**(「さっき見た行が無い」)
 * - ページ送りで**同じ行が 2 回出る / 出ない行がある**
 *
 * **平常時は正常に見える**——開発中は行数が少なく、順序も安定して見えるため。
 * 2026-08 に 28 件見つかり、**商品一覧・用語集・設定**を直した。
 *
 * 【上限方式にする理由】
 * **後段で並べ替えるもの**(チャットのメンバーを取得して `sortRoomsByActivity` へ渡す等)や、
 * **集計に使うだけ**のものは順序が要らない。一律に禁じると、
 * 意味のない `orderBy` が増えて**本当に必要な場所が埋もれる**。
 *
 * 【直すときの判断】
 * **画面に一覧として出るか**で決める。出るなら業務の慣れに合う順にすること
 * ——商品なら SKU 順(棚番や型番の並びと対応する)、用語なら五十音順。
 * **`id` 順にしない**——利用者にとって意味が無く、「なぜこの順なのか」が説明できない。
 *
 * 使い方:
 * ```
 * node tools/check-order-by.mjs
 * node tools/check-order-by.mjs --list
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/**
 * 現在の件数(上限)。
 *
 * **上限ファイルを作らず、ここに書く。** 上限ファイルが増えるほど
 * 「緑でも守れていない」範囲が広がるので、smoke が **6 件以内**に制限している。
 *
 * 残っている 15 件は、**後段で並べ替えるもの**(チャットのメンバー)や
 * **集計に使うだけ**のもの。減らしたらこの数字を下げること。
 */
const LIMIT = 15;

/**
 * `orderBy` の無い `findMany` を探す。
 *
 * **括弧の対応で引数の範囲を取る。** 正規表現で `{...}` を拾うと、
 * **入れ子の `where: { x: { in: [...] } }` で途中が切れて**誤検出する
 * (2026-08 に実際そうなった)。
 */
function findUnordered() {
  const hits = [];
  for (const rel of collectFiles(["apps", "packages"], ROOT, { extensions: [".ts"] })) {
    if (/\.test\.ts$/.test(rel)) continue;
    const norm = rel.replace(/\\/g, "/");
    // **生成物は対象外**(元のソースを直す)
    if (norm.includes(".generated.")) continue;
    // **seed は 1 回しか走らない**(順序が問われない)
    if (norm.includes("/prisma/seed.")) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    let i = 0;
    while ((i = src.indexOf(".findMany(", i)) >= 0) {
      const start = i + ".findMany(".length;
      let depth = 1;
      let j = start;
      while (j < src.length && depth > 0) {
        const c = src[j];
        if (c === "(") depth += 1;
        else if (c === ")") depth -= 1;
        j += 1;
      }
      if (!/orderBy/.test(src.slice(start, j - 1))) {
        hits.push({ file: norm, line: src.slice(0, i).split("\n").length });
      }
      i = j;
    }
  }
  return hits;
}

const hits = findUnordered();
const limit = LIMIT;

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h.file}:${h.line}`);
}

if (hits.length > limit) {
  console.error(`❌ 並び順を指定していない findMany が ${hits.length} 件に増えました(上限 ${limit})`);
  for (const h of hits.slice(0, 10)) console.error(`   ${h.file}:${h.line}`);
  console.error("");
  console.error("**DB が返す順は不定です**。行を更新すると順序が変わり、");
  console.error("**一覧を開くたびに並びが違う / 更新した行が別の場所へ飛ぶ**ことになります。");
  console.error("画面に出す一覧なら、**業務の慣れに合う順**を指定してください(SKU 順・五十音順など)。");
  process.exit(1);
}

console.log(`✅ 並び順の指定漏れは上限内です(${hits.length} 件 / 上限 ${limit})`);
