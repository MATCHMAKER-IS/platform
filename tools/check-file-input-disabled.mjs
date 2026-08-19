/**
 * **ファイル選択が「処理中」に無効化されているかを確かめる。**
 *
 * 【なぜ見張るか】
 * `<FileInput>` に `disabled` を渡していないと、**アップロード中でも
 * もう一度選べる**。押した本人は「反応が無い」と思って選び直すので、
 * **同じファイルが二重に上がる**。
 *
 * 2026-08 に 6 箇所で見つかった。実害の例:
 *
 * - 用語集の CSV … **同じ用語が重複登録される**
 * - テーマの JSON … **同じテーマが二重に増える**
 * - 経費の証憑 … **同じ領収書が 2 枚添付される**
 *
 * どれも**エラーにならない**ので、後から「なぜ 2 件あるのか」を調べることになる。
 *
 * 【`useSubmit` との関係】
 * ボタンの二重送信は `@platform/ui` の `useSubmit` が防ぐが、
 * **ファイル選択は経路が違う**(`<input type="file">` の `change`)。
 * `useSubmit` を使っていても、`FileInput` に `disabled` を渡さなければ防げない。
 *
 * 【`showcase` を対象外にする理由】
 * 基盤の見本なので、**部品の最小の使い方**を見せている。
 * 実際の業務データを扱わないため、二重に選んでも実害が無い。
 *
 * 使い方:
 * ```
 * node tools/check-file-input-disabled.mjs
 * node tools/check-file-input-disabled.mjs --list
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `disabled` を渡していない `<FileInput>` を探す。 */
function findUnguarded() {
  const hits = [];
  for (const rel of collectFiles(["apps"], ROOT, { extensions: [".tsx"] })) {
    const norm = rel.replace(/\\/g, "/");
    // **`showcase` は見本**(業務データを扱わないので二重でも実害が無い)
    if (norm.startsWith("apps/showcase/")) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
// **上限の理由**: `<FileInput ... />` の属性の長さ。
// 2026-08 の実測で **17 件すべて 400 以内**（最長 324）。
// 超えると**見逃す**ので、増やすときは実測してから。
    for (const m of src.matchAll(/<FileInput[\s\S]{0,400}?\/>/g)) {
      if (/disabled=/.test(m[0])) continue;
      const line = src.slice(0, m.index).split("\n").length;
      hits.push({ file: norm, line });
    }
  }
  return hits;
}

const hits = findUnguarded();

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h.file}:${h.line}`);
}

if (hits.length > 0) {
  console.error(`❌ 処理中に無効化していないファイル選択が ${hits.length} 件あります`);
  for (const h of hits.slice(0, 10)) console.error(`   ${h.file}:${h.line}`);
  console.error("");
  console.error("**アップロード中でも選べると、同じファイルが二重に上がります**。");
  console.error("押した人は「反応が無い」と思って選び直すので、確実に起きます。");
  console.error("`<FileInput disabled={busy} ... />` のように、処理中の状態を渡してください。");
  process.exit(1);
}

// **走査量を出す**（何も見ていないのに緑、を防ぐ）
const scannedCount = collectFiles(["apps"], ROOT, { extensions: [".tsx"] }).length;
console.log(`✅ ファイル選択はすべて処理中に無効化されています(${scannedCount} ファイルを検査 / showcase は見本のため対象外)`);
