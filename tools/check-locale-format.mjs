#!/usr/bin/env node
/**
 * **`toLocale*()` にロケールが指定されているかを確かめる。**
 *
 * 【何が起きるか】
 * ロケールを省くと**実行環境の既定**で整形される。金額でこれが起きる:
 *
 * ```
 * (1234567.89).toLocaleString()          // 環境次第
 *   LANG=ja_JP → 1,234,567.89
 *   LANG=de_DE → 1.234.567,89   ← 小数点とカンマが逆
 *   LANG=ar_EG → ١٬٢٣٤٬٥٦٧٫٨٩   ← 数字そのものが変わる
 * ```
 *
 * 日時はさらに大きく変わる(`8/9/2026, 5:30:00 AM` と `2026/8/9 5:30:00`)。
 *
 * **ブラウザだけの話ではない。** 2026-08 時点で `apps/internal-app/src/server/`
 * (アラート・帳票)と `packages/payroll` `packages/tax`(源泉徴収・印紙税の
 * エラーメッセージ)がサーバ側で金額を整形していた。
 * **サーバの `LANG` が変わると、帳票やメールの金額表記が変わる**。
 * Node の既定は `en-US` だが、コンテナの設定次第で何にでもなる。
 *
 * 手元では正しく見え、テストも通る。**環境を変えたときにだけ壊れる**形。
 *
 * 【線引き】
 * 明示的に別のロケールを渡しているものは対象外(`"en-US"` で英文帳票を
 * 作るなど、意図があるもの)。**省略だけを問題にする。**
 *
 * 実行: node tools/check-locale-format.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

function collect(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) acc.push(p);
  }
  return acc;
}

const files = [...collect(path.join(ROOT, "packages")), ...collect(path.join(ROOT, "apps"))]
  .filter((f) => !f.includes(".generated."));

const issues = [];
let checked = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    // **第 1 引数が無い形だけを見る。** `toLocaleString(loc)` のように
    // 変数で渡している場合は、呼び出し側が決めているので触らない
    for (const m of line.matchAll(/\.toLocale(String|DateString|TimeString)\(\s*(\{|\))/g)) {
      checked += 1;
      // `toLocaleString({ ... })` はロケール省略でオプションだけ渡す形。これも対象
      issues.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 整形のロケール指定に漏れはありません(${files.length} ファイルを検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**環境の LANG によって表記が変わります。**`);
console.error('`toLocaleString("ja-JP")` のようにロケールを明示してください。');
console.error("金額は `formatYen`(@platform/report)を使う方がより確実です。");
process.exit(1);
