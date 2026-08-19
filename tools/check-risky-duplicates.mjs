#!/usr/bin/env node
/**
 * **壊れると実害がある同名関数が、複数パッケージに増えていないか。**
 *
 * 【なぜ要るか】
 * 2026-08 に同名関数の重複を全部洗ったところ、**7 件中 5 件で対応が要った**:
 *
 *  - `maskEmail` … 片方が **1 文字を素通し**、**文字数が漏れる**
 *  - `isValidEmail` … 画面と送信で **4 通り食い違い**(画面では有効なのに送信で弾かれる)
 *  - `validateAttachments` … 既定が無く、**呼び出し側が渡さないと検証ごと飛ぶ**
 *  - `escapeHtml` … 一致しているが**乖離しうる**
 *  - `unescapeHtml` … `&nbsp;` の扱いが違う
 *
 * **複製そのものは悪くない。** 依存を増やさない判断は正しく、
 * `@platform/html` を基盤依存ゼロに保つ・`@platform/ui` を軽くする、には意味がある。
 * 悪いのは**乖離を放置すること**で、統合しないなら**一致を見張る検査**を置く。
 *
 * この検査は「新しい重複が増えたら知らせる」だけで、**良し悪しは判断しない**。
 * 見つかったら、① 統合する ② 一致を見張る検査を足す ③ 差を明記して ALLOW に載せる、
 * のどれかを選ぶこと。
 *
 * 実行:
 *   node tools/check-risky-duplicates.mjs        件数を見る
 *   node tools/check-risky-duplicates.mjs --list 内訳を出す
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";
import { stripComments } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST = process.argv.includes("--list");

/**
 * 壊れると実害がある名前。
 *
 * **`format` や `parse` は入れない。** 表示が変わるだけで、
 * 守りが弱くなるわけではないため(件数が多すぎて実害のあるものが埋もれる)。
 */
const RISKY = /escape|sanitiz|mask|verify|valid|safe|hash|encrypt|decrypt|sign(?!ature)|token|redact/i;

/**
 * 確認済みの重複。**扱いを必ず書く。**
 */
const ALLOW = [
  { name: "escapeHtml", why: "html / mail / utils。同じ 5 文字を守る。smoke が一致を見張る" },
  // **アプリ側は基盤への薄いラッパー**(旧形式の検証を挟むため関数名を保っている)。
  // 実装は `@platform/crypto` に委譲しており、**強度は基盤で一元管理**されている
  { name: "hashPassword", why: "internal-app は @platform/crypto へ委譲する薄いラッパー(旧形式の検証を挟む)" },
  { name: "verifyPassword", why: "同上。scrypt のコストは基盤側で一元管理" },
  // **Books と Inventory は同じ API 形式**(`page_context.has_more_page`)。
  // 依存を増やさないため複製している——**片方を直したらもう片方も**
  { name: "listAll", why: "zoho/books と zoho/inventory。Books の API 形式が同じなので同じ実装(複製)" },
  // **エスケープを忘れるとファイル全体が読めなくなる**ので、
  // どちらも同じ 5 文字を変換する。smoke が単体で読むため複製している
  { name: "escapeXml", why: "xml と feed。依存を増やさないため複製。**smoke が一致を見張る**(食い違うと同じ記事が別の文字列になる)" },
  { name: "canonicalJson", why: "json と dencho。ハッシュ計算に使うため依存ゼロを保つ。**smoke が一致を見張る**(食い違うと電子帳簿保存法のハッシュチェーンが全件改ざん扱いになる)" },
  { name: "unescapeHtml", why: "html / utils。`&nbsp;` の扱いが違うが復号なので守りには影響しない(TSDoc に明記)。**smoke が一致を見張る**" },
  { name: "isValidEmail", why: "mail / ui。同じ式を複製。smoke が一致を見張る" },
  { name: "validateAttachments", why: "board / chat / mail。用途が違う(投稿の添付とメール添付)。それぞれに既定がある" },
  { name: "isValidCorporateNumber", why: "tax / validation。結果が完全一致(2026-08 に確認)" },
  { name: "maskPhone", why: "phone / pii。結果が一致(2026-08 に確認)。**smoke が一致を見張る**" },
  { name: "maskEmail", why: "pii / utils。2026-08 に揃えた(片方が 1 文字を素通ししていた)。**smoke が一致を見張る**" },
];

const byName = new Map();
// **アプリ側も見る。** 2026-08 まで `packages` だけを見ており、
// **アプリが基盤と同名の関数を自前で持っていても気づけなかった**
// ——`sha256Hex`(監査ログの改ざん検知)や `requirePermission`(認可)が
// 基盤とアプリの両方にあり、片方だけ直すと**守れているつもりで守れていない**。
for (const rel of collectFiles(["packages", "apps"], ROOT, { extensions: [".ts"] })) {
  if (rel.includes(".test.") || rel.includes(".generated.")) continue;
  const pkg = rel.split("/")[1];
  const code = stripComments(readFileSync(path.join(ROOT, rel), "utf8"));
  for (const m of code.matchAll(/export (?:async )?function (\w+)/g)) {
    const name = m[1];
    if (!RISKY.test(name)) continue;
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add(pkg);
  }
}

const dups = [...byName].filter(([, pkgs]) => pkgs.size > 1);
const unknown = dups.filter(([name]) => !ALLOW.some((a) => a.name === name));

if (LIST) {
  for (const [name, pkgs] of dups) {
    const known = ALLOW.find((a) => a.name === name);
    console.log(`   ${name.padEnd(24)} ${[...pkgs].join(", ")}`);
    if (known) console.log(`      → ${known.why}`);
  }
}

if (unknown.length > 0) {
  for (const [name, pkgs] of unknown) {
    console.error(`❌ ${name}: ${[...pkgs].join(", ")} に重複しています`);
  }
  console.error(`\n${unknown.length} 件。**片方だけ弱いと、どちらを使ったかで守りが変わります。**`);
  console.error("① 統合する ② 一致を見張る検査を足す ③ 差を明記して ALLOW に載せる のどれかを選んでください。");
  process.exit(1);
}
console.log(`✅ 実害のある同名関数の重複は確認済みのものだけです(${dups.length} 件 / ${byName.size} 名を検査)`);
