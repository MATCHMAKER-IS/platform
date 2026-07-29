/**
 * **「今」から UTC の日付を切り出していないか**を検出する。
 *   node tools/check-utc-date.mjs
 *   node tools/check-utc-date.mjs --list
 *   node tools/check-utc-date.mjs --set-limit
 *
 * 【なぜ必要か】
 * `new Date().toISOString().slice(0, 10)` は **UTC の日付**を返す。
 * JST は UTC+9 なので、**深夜 0 時から朝 9 時までの 9 時間は前日**になる。
 *
 *   JST 2026-07-29 00:30 → "2026-07-28"
 *
 * 昼間に書いて昼間に試すと必ず通るため、テストでも気づけない。
 * 夜間バッチ・早朝の打刻・締め処理で初めて出て、しかも「たまにおかしい」
 * としか見えない。**この基盤が最も避けたい、気づけない壊れ方**。
 *
 * 置き換え先は `@platform/datetime` の:
 *   - `formatDateJst(date?)` … JST の `YYYY-MM-DD`
 *   - `todayJst(now?)`       … JST の今日(UTC 0 時の Date)
 *
 * 【誤検知について】
 * 既に UTC 0 時へ正規化済みの「日付だけの値」に対する `toISOString().slice(0,10)` は正しい
 * (`utcDate()` や Prisma の `@db.Date` から来た値など)。
 * そのため **`new Date()` から直接切り出している形**に絞って検出する。
 * 変数経由のものは判定できないので、上限つき(ラチェット)で「増やさない」を守る。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIMIT_FILE = path.join(ROOT, "tools", "utc-date-limit.json");

/** `new Date()` から直接 UTC の日付を切り出している形。 */
const NOW_TO_UTC_DATE = /new Date\(\s*\)\s*\.toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*10\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\]|substring\(\s*0\s*,\s*10\s*\))/;

// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)
const files = collectFiles(["packages", "apps", "demos", "tools"], ROOT, {
  extensions: [".ts", ".tsx", ".mts"],
});

const hits = [];
for (const rel of files) {
  if (rel.includes(".test.")) continue; // テストは意図的に UTC を書くことがある
  // 生成物は対象外。TSDoc の説明文(置き換え先の案内)がそのまま取り込まれるため
  if (rel.includes(".generated.")) continue;
  const text = readFileSync(path.join(ROOT, rel), "utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    // コメント行は対象外。**置き換え先の説明にこの形が出てくる**ため
    // (formatDateJst の TSDoc がまさにそれで、自分自身を検出してしまう)
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (NOW_TO_UTC_DATE.test(line)) hits.push(`${rel}:${i + 1}`);
  }
}

const limit = existsSync(LIMIT_FILE) ? JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit : hits.length;

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({ limit: hits.length }, null, 2)}\n`);
  console.log(`✅ 上限を ${hits.length} に更新しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) for (const h of hits) console.log(`  ${h}`);

if (hits.length > limit) {
  console.error(
    `❌ 「今」から UTC の日付を切り出している箇所が ${hits.length} 件あります(上限 ${limit})。` +
    "\n   JST の 00:00〜08:59 に実行すると**前日**になります。" +
    "\n   @platform/datetime の formatDateJst() / todayJst() を使ってください。" +
    "\n   一覧: node tools/check-utc-date.mjs --list",
  );
  for (const h of hits) console.error(`     ${h}`);
  process.exitCode = 1;
} else if (hits.length > 0) {
  console.log(`⚠ 「今」から UTC の日付を切り出している箇所が ${hits.length} 件あります(上限 ${limit})。formatDateJst() へ移行してください`);
} else {
  console.log("✅ 「今」から UTC の日付を切り出している箇所はありません");
}
