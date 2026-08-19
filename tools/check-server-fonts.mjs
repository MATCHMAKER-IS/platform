#!/usr/bin/env node
/**
 * **サーバで PDF・画像にする HTML に、サーバに実在するフォントが指定されているか。**
 *
 * 【なぜ要るか】
 * 帳票の CSS には `"Hiragino Kaku Gothic ProN"`(macOS)や `"Yu Gothic"`(Windows)が
 * 並んでいることが多い。**画面はそれで正しく描ける**——利用者の端末にあるから。
 * だがサーバ(Linux コンテナ)には 1 つも無い。
 *
 * さらに紛らわしいのが `"Noto Sans JP"` で、これは **Google Fonts の Web 版の名前**。
 * Debian の `fonts-noto-cjk` が入れるのは **`Noto Sans CJK JP`**(別名)。
 * 取り違えると指定が全て外れ、`sans-serif` にフォールバックする。
 * 日本語グリフを持たないフォントに落ちると **□(豆腐)が並ぶ**。
 *
 * **開発中は絶対に気づけない。** 画面は端末のフォントで描かれるので正常に見え、
 * サーバ側で描く帳票・グラフ・OGP 画像だけが壊れる。しかも文字化けではなく
 * □ が並ぶので、原因がフォントだと分かりにくい。
 *
 * 2026-08 に、請求書・経費・月次・給与明細の 4 つがこの状態だった
 * (Dockerfile にフォント自体が入っていなかったのも同時に判明)。
 *
 * 実行: node tools/check-server-fonts.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/**
 * Linux コンテナに入れうる日本語フォント名。
 *
 * **`Noto Sans JP` は含めない。** それは Web 版の名前で、
 * `fonts-noto-cjk` が入れるのは `Noto Sans CJK JP`。
 */
const SERVER_FONTS = /Noto Sans CJK JP|Noto Serif CJK JP|IPAexGothic|IPAGothic|VL Gothic|TakaoGothic/;

/** 対象外。**理由を必ず添える。** */
const ALLOW = [
  { re: /status-page/, why: "ブラウザで表示する状態ページ。サーバで画像化しない" },
  { re: /packages\/ui\/src\/styles/, why: "画面のデザイントークン。端末のフォントで描く" },
  // **メール本文は受信者のメーラーが描く。** こちらのサーバでは描画しないので、
  // 端末のフォント(Hiragino / Yu Gothic)を並べるのが正しい
  { re: /packages\/mail\/src\/template\.ts$/, why: "メール本文。受信者のメーラーが描く" },
];

// **共通処理を使う**(除外ディレクトリの食い違いを防ぐ)。相対パスで返る
const files = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx", ".css"] })
  .filter((f) => !f.includes(".generated."));

const issues = [];
let checked = 0;

for (const file of files) {
  const rel = file;
  if (ALLOW.some((a) => a.re.test(rel))) continue;
  const lines = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    if (!/font-family/.test(line)) continue;
    if (!/Hiragino|Yu Gothic|Meiryo|Noto Sans JP/.test(line)) continue;
    // コメント行は対象外(この検査の説明文がそのまま引っかかる)
    if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
    checked += 1;
    if (SERVER_FONTS.test(line)) continue;
    issues.push(`${rel}:${i + 1}: サーバに実在するフォントが指定されていません`);
  }
}

if (issues.length === 0) {
  console.log(`✅ サーバで描く HTML のフォント指定は妥当です(${checked} 箇所を検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**サーバで PDF 化すると □(豆腐)になります。**`);
console.error('`"Noto Sans CJK JP"` を並びに加えてください');
console.error('(`"Noto Sans JP"` は Google Fonts の Web 版の名前で、Linux には入りません)。');
console.error("画面だけで使う CSS なら ALLOW に理由付きで登録すること。");
process.exit(1);
