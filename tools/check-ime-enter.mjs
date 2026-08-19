#!/usr/bin/env node
/**
 * **Enter を拾うのに、日本語入力の変換中を見ていない箇所を探す。**
 *
 * 【何が起きるか】
 * 日本語入力では、漢字を選ぶ操作そのものが Enter。
 * `e.key === "Enter"` だけを見ると、**変換を確定した瞬間に送信される**。
 * 「田中」と打とうとして「たなか」の変換を確定した時点で送られてしまう。
 *
 * 英語環境では起きないので、**作った人が英語で試すと気づけない**。
 * この基盤は日本語の業務アプリ向けなので、実質すべての入力欄で起きうる。
 *
 * 【なぜ検査が要るか】
 * 基盤には `useComposition()`(`@platform/ui`)があり、
 * デモ(`/inquiries`)にも「`isComposing` を見ないと変換を確定した瞬間に
 * フォームが送信されます」と**警告が書いてある**。それでも 2026-08 時点で
 * **Enter を拾う 20 ファイルのうち、見ていたのは 1 つだけ**だった。
 * 文書と部品があるだけでは足りない。
 *
 * 【誤検出を避けるための線引き】
 * Enter を拾っても危なくない使い方がある:
 *  - **ボタン相当の要素**(`role="button"` の div など)。文字入力が無いので変換も無い
 *  - **Escape や矢印と並べた操作キーの処理**(一覧の移動など)
 *  - `<textarea>` で `Shift+Enter` を改行に使う形は、Enter 単独が送信なので**対象**
 *
 * 判定は「同じ要素が文字入力を受けるか」で行う——
 * `onChange` を持つ、または `Input` / `Textarea` / `input` / `textarea` に付いていること。
 *
 * 実行:
 *   node tools/check-ime-enter.mjs             件数を見る
 *   node tools/check-ime-enter.mjs --list      該当箇所を出す
 *   node tools/check-ime-enter.mjs --set-limit 上限を現在値に下げる
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "ime-enter-limit.json");
const LIST = process.argv.includes("--list");
const SET = process.argv.includes("--set-limit");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/** 変換中を見ていると認められる書き方。 */
const GUARDED = /isComposing|useComposition|nativeEvent\.isComposing|composing/;

// **共通処理を使う**(除外ディレクトリの食い違いを防ぐ)。相対パスで返る
const files = collectFiles(["apps", "packages"], ROOT, { extensions: [".tsx"] })
  .filter((f) => !f.includes(".generated."));

const offenders = [];
let checked = 0;

for (const file of files) {
  const rel = file;
  // **部品そのものは対象外。** `useComposition` の実装や、
  // 変換の扱いを説明するデモは、この形を文字列として持つのが仕事
  if (rel.endsWith("use-composition.tsx")) continue;
  const lines = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    if (!/key === ["']Enter["']/.test(line)) continue;
    checked += 1;
    // 同じ行か、前後 6 行に変換中の判定があれば良しとする
    // (`const { isComposing } = useComposition()` は少し離れた場所に書かれる)
    const near = lines.slice(Math.max(0, i - 6), i + 3).join("\n");
    if (GUARDED.test(near) || GUARDED.test(lines.slice(0, i).join("\n").slice(-2000))) continue;
    // **文字入力を受ける要素だけを対象にする。**
    // ボタン相当(role="button")や一覧のキー操作では変換が起きない
    const around = lines.slice(Math.max(0, i - 12), i + 6).join("\n");
    const isTextInput = /onChange=|<Input\b|<Textarea\b|<input\b|<textarea\b/.test(around);
    const isButtonLike = /role=["']button["']|role=["']option["']|role=["']menuitem["']/.test(around);
    if (!isTextInput || isButtonLike) continue;
    offenders.push(`${rel}:${i + 1}`);
  }
}

const limit = (() => {
  try { return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? 0; } catch { return offenders.length; }
})();

if (SET) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "変換中を見ずに Enter を拾っている箇所の上限。useComposition() を使うと減る。増やさないための歯止め。",
    limit: offenders.length,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を更新しました(${offenders.length})`);
  process.exit(0);
}

if (LIST) for (const o of offenders) console.log(`   ${o}`);

if (offenders.length > limit) {
  console.error(`❌ 変換中を見ずに Enter を拾う箇所が ${offenders.length} 件に増えました(上限 ${limit})`);
  console.error("   日本語入力では**変換を確定した瞬間に送信されます**。");
  console.error("   `useComposition()`(@platform/ui)を使ってください:");
  console.error('   const { isComposing, handlers } = useComposition();');
  console.error('   <Input {...handlers} onKeyDown={(e) => { if (e.key === "Enter" && !isComposing) submit(); }} />');
  process.exit(1);
}
console.log(`⚠ 変換中を見ずに Enter を拾う箇所 ${offenders.length} 件 / Enter を拾う ${checked} 箇所(上限 ${limit})`);
console.log("   日本語では変換確定で送信されます。**英語で試すと気づけません**(詳細は --list)。");
console.log("✅ 上限内です");
