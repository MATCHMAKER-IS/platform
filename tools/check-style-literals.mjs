/**
 * **見た目の値の直書き**(文字サイズ・角丸)が増えていないかを見張る。
 *
 * 【なぜ見張るか】
 * `style={{ fontSize: 13 }}` はその場で書けるので、**書くたびに増える**。
 * 2026-08 の時点で **14 種類・303 箇所**あり、
 * `9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 24 / 40 / 48` が
 * 混在していた——**1px 刻みの違いに意味があるとは考えにくい**。
 *
 * 同じ役割の文字(表の補足・ラベル・見出し)が**画面によって違うサイズ**になり、
 * 並べたときにちぐはぐに見える。**文字サイズを変えると印象が変わる**ので、
 * 見た目の判断は人がすべきもの——ここでは**増やさないことだけ**を守る。
 *
 * **角丸も同じ**。`borderRadius: 8` が 102 件あり、`4 / 6 / 8 / 10 / 12` が混在していた
 * ——テーマには **`--radius`** があるのに使っていないので、
 * **テーマを切り替えても角丸が変わらない**(`999` はピル形状なので意図的)。
 *
 * 【Tailwind・テーマとの対応】
 * `text-xs`(12px) / `text-sm`(14px) / `text-base`(16px)、
 * 角丸は `rounded`(`var(--radius)`)を使えば、**テーマで一括して変えられる**。
 * 直書きは変えられない。
 *
 * 【余白(`padding` / `gap` / `margin`)を対象にしない理由】
 * 2026-08 に数えたところ、**176 件のうち 152 件(86%)が 4px グリッド**に乗っていた
 * (`4 / 8 / 12 / 16 / 24 / 40`)。外れているのは `2px`(2 件)・`6px`(13 件)・
 * `10px`(9 件)だけで、**基準そのものは守られている**。
 *
 * 文字サイズは `9〜48px` の **14 種類がバラバラ**で基準が無かったのに対し、
 * 余白は基準がある——**同じ「直書き」でも状態が違う**ので、
 * 一律に見張ると「守れているものまで違反」に見えてしまう。
 * **崩れてから足すこと**(4px グリッド外が増えたら、その時点で対象にする)。
 *
 * 【減らすときの順番】
 * 1. **Tailwind に無い中間値**(9 / 11 / 13 / 15)から。近い方へ寄せる
 * 2. 次に 10 / 18 / 20 / 22(`text-xs` 〜 `text-2xl` の範囲)
 * 3. 40 / 48 は見出し用。`text-4xl` などに対応するので最後
 *
 * **一度に全部やらない。** 見た目が変わるので、画面ごとに確かめること。
 *
 * 使い方:
 * ```
 * node tools/check-style-literals.mjs
 * node tools/check-style-literals.mjs --list
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";
import { stripComments } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/**
 * 現在の件数(上限)。
 *
 * **上限ファイルを作らず、ここに書く。** 上限ファイルが増えるほど
 * 「緑でも守れていない」範囲が広がるので、smoke が **6 件以内**に制限している。
 * この検査は**減らす作業が見た目の判断を伴う**(文字サイズを変えると印象が変わる)ため、
 * しばらく動かない見込み——ファイルにするより**コードに書いて理由を添える**方がよい。
 *
 * 減らしたらこの数字を下げること(`--list` で内訳が出る)。
 */
const LIMIT = 421;

/** 直書きの見た目の値を探す。 */
function findLiterals() {
  const hits = [];
  for (const rel of collectFiles(["apps", "packages"], ROOT, { extensions: [".tsx"] })) {
    const norm = rel.replace(/\\/g, "/");
    // **`showcase` は見本**(基盤の見え方を見せるので、あえて直書きする場面がある)
    if (norm.startsWith("apps/showcase/")) continue;
    // **説明文の中の `fontSize: 13` を拾わない**(自分の説明で違反者になる)
    const code = stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    for (const m of code.matchAll(/(fontSize|borderRadius):\s*(\d+)/g)) {
      // **`999` はピル形状**(完全な丸)。テーマで変える対象ではない
      if (m[1] === "borderRadius" && Number(m[2]) >= 999) continue;
      const line = code.slice(0, m.index).split("\n").length;
      hits.push({ file: norm, line, kind: m[1], size: Number(m[2]) });
    }
  }
  return hits;
}

const hits = findLiterals();
const limit = LIMIT;

if (process.argv.includes("--list")) {
  for (const kind of ["fontSize", "borderRadius"]) {
    const bySize = new Map();
    for (const h of hits.filter((x) => x.kind === kind)) bySize.set(h.size, (bySize.get(h.size) ?? 0) + 1);
    if (bySize.size === 0) continue;
    console.log(`   ${kind}(小さい順):`);
    for (const size of [...bySize.keys()].sort((a, b) => a - b)) {
      console.log(`     ${String(size).padStart(3)}px … ${bySize.get(size)} 件`);
    }
  }
}

if (hits.length > limit) {
  console.error(`❌ 見た目の値の直書きが ${hits.length} 件に増えました(上限 ${limit})`);
  console.error("");
  console.error("**その場で書けるので、書くたびに増えます**。");
  console.error("`text-xs`(12px) / `text-sm`(14px) / `text-base`(16px) を使えば、");
  console.error("**テーマで一括して変えられます**——直書きは変えられません。");
  process.exit(1);
}

console.log(`✅ 見た目の値の直書きは上限内です(${hits.length} 件 / 上限 ${limit})`);
