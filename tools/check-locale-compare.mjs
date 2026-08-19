#!/usr/bin/env node
/**
 * **日本語が入りうる値の並べ替えに、ロケールが指定されているかを確かめる。**
 *
 * 【何が起きるか】
 * `a.localeCompare(b)` はロケールを省くと**実行環境の既定**で比較する。
 * 日本語では結果が変わる:
 *
 * ```
 * ["経費","勤怠","給与"].sort((a,b) => a.localeCompare(b))        // 勤怠 経費 給与
 * ["経費","勤怠","給与"].sort((a,b) => a.localeCompare(b, "ja"))  // 給与 勤怠 経費
 * ```
 *
 * 漢字はさらに差が大きく、`["斎藤","伊藤","上田","阿部"]` は
 * 未指定だと `上田 伊藤 斎藤 阿部`、`"ja"` 付きだと `阿部 伊藤 斎藤 上田` になる。
 *
 * **同じ画面を別の環境で開くと順序が違う**、という再現しにくい形になる。
 * 手元では正しく見えるので、テストも書きにくい。
 *
 * 【誤検出を避けるための線引き】
 * 並べ替えの対象が **ASCII だと分かるもの**は指定しなくてよい:
 * 日付(`dueDate` / `expiry` / `start` / `month`)、識別子(`id` / `userId`)、
 * 環境変数名など。**フィールド名で判断する**——名前から日本語が入りうるかを見る。
 *
 * 2026-08 時点で 11 箇所が未指定だったが、日本語が入るのは
 * `packages/faq` の `category`(「経費」「勤怠」)だけだった。残りは日付と ID。
 *
 * 実行: node tools/check-locale-compare.mjs
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { argsAt } from "./lib/source-text.mjs";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

/**
 * ASCII しか入らないと判断できるフィールド名。
 *
 * **理由を添えること。** 迷ったら足さずに `"ja"` を付ける方が安全
 * (日本語に `"ja"` を付けて困ることは無いが、逆は起きる)。
 */
const ASCII_FIELDS = [
  { re: /\b(id|userId|key|slug|code|email|path|url)\b/i, why: "識別子。ASCII しか入らない" },
  { re: /\b(date|dueDate|expiry|start|end|month|year|at|createdAt|updatedAt)\b/i, why: "日付・時刻。ISO 文字列" },
  { re: /\benv\b|EnvRow|環境変数/i, why: "環境変数名。ASCII しか入らない" },
  { re: /\bversion\b/i, why: "版番号" },
];


// **共通処理を使う**(除外ディレクトリの食い違いを防ぐ)。相対パスで返る
const files = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx"] })
  .filter((f) => !f.includes(".generated."));

const issues = [];
let checked = 0;

for (const file of files) {
  const rel = file;
  const lines = readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n").split("\n");
  for (const [i, line] of lines.entries()) {
    for (const m of line.matchAll(/\.localeCompare\(/g)) {
      checked += 1;
      // **`[^)]*` で引数を取らない。** `localeCompare(String(bv), "ja")` のように
      // 入れ子の括弧があると最初の `)` で切れ、**正しく "ja" を渡している行を
      // 誤検出する**(2026-08 にここで一度つまずいた)。括弧の対応を数えて取る。
      const args = argsAt(line, m.index + m[0].length - 1);
      // ロケールが渡っていれば良し
      if (/["'][a-z]{2}(-[A-Z]{2})?["']/.test(args)) continue;
      // ASCII だけと分かるフィールドは対象外
      // **行だけでなくファイルの位置も見る。** `packages/env` の `name` は
      // 環境変数名だが、行の文字列からはそれが読み取れない
      if (ASCII_FIELDS.some((a) => a.re.test(line) || a.re.test(rel))) continue;
      issues.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 並べ替えのロケール指定に漏れはありません(${checked} 箇所を検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**日本語の並び順が実行環境で変わります。**`);
console.error('`localeCompare(other, "ja")` とロケールを渡してください。');
console.error("ASCII しか入らないと確信できる場合は ASCII_FIELDS に理由付きで登録すること。");
process.exit(1);
