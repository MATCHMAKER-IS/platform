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
import { stripComments, argsAt } from "./lib/source-text.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LIMIT_FILE = path.join(ROOT, "tools", "utc-date-limit.json");

/** `new Date()` から直接 UTC の日付を切り出している形。 */
// **月(`slice(0, 7)`)も見る。**
// 日だけを対象にしていたため、`new Date().toISOString().slice(0, 7)` が
// 9 画面で通り抜けていた(2026-08)。月初の 00:00〜08:59 に開くと**前月**になり、
// 勤怠・給与・予算・月次締めがそのままずれる。
/**
 * **サーバ側で「今」の年月日をローカル解釈する形。**
 *
 * `new Date().getFullYear()` などは**プロセスのタイムゾーン**で解釈される。
 * クラウドの既定は UTC なので、JST の 8/1 00:30 は 7 月として扱われる。
 *
 * 2026-08 に `packages/sequence` の `periodToken` がこれで、
 * **月次リセットの採番で 8 月最初の伝票に 7 月の連番が払い出されていた**。
 * 年またぎだと 1 年ずれ、影響が 12 か月続く。
 * 昼間に試すと必ず通るので、深夜の申請でだけ起きて気づけない。
 *
 * **画面(`.tsx` / `packages/ui`)は対象外**——端末のタイムゾーンは JST なので、
 * カレンダーや時刻表示ではローカル解釈が正しい。
 */
const NOW_TO_LOCAL_PARTS = /new Date\(\s*\)\s*\.(getFullYear|getMonth|getDate|getHours|getDay)\(/;

/**
 * **「今日」として使う変数から UTC の日付を切り出す形。**
 *
 * `NOW_TO_UTC_DATE` は `new Date().toISOString()` を見張るが、
 * `today.toISOString().slice(0, 10)` のように**引数で受けた Date**は対象外だった
 * ——2026-08 に 6 箇所見つかった(タスクの期限・健康診断・下請法・公益通報)。
 *
 * UTC で動くサーバでは **JST の 00:00〜08:59 が前日**になり、
 * 期限切れのはずのものが「まだ間に合う」と出る。
 *
 * `today` / `now` / `asOf` / `at` という名前の変数に限る
 * (任意の Date から日付を切り出すのは正しい用途もあるため)。
 */
const VAR_TO_UTC_DATE = /\b(?:today|now|asOf|at)\s*\.toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*(?:7|10)\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\])/;

const NOW_TO_UTC_DATE = /new Date\(\s*\)\s*\.toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*(?:7|10)\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\]|substring\(\s*0\s*,\s*(?:7|10)\s*\))/;

// `find` は Windows で別コマンドになるため使わない(tools/lib/collect-files.mjs 参照)
const files = collectFiles(["packages", "apps", "tools"], ROOT, {
  extensions: [".ts", ".tsx", ".mts"],
});

const hits = [];
for (const rel of files) {
  if (rel.includes(".test.")) continue; // テストは意図的に UTC を書くことがある
  // 生成物は対象外。TSDoc の説明文(置き換え先の案内)がそのまま取り込まれるため
  if (rel.includes(".generated.")) continue;
  const text = readFileSync(path.join(ROOT, rel), "utf8");

  // **引数の既定が「今」なのに UTC で数える関数**を探す。
  //
  // 行単位の検査では捕まらない形。`age(birth, at = new Date())` のように
  // 既定を持つ引数に対して `at.getUTCFullYear()` を使うと、
  // **JST の早朝に日付が 1 日ずれる**——`age` は誕生日当日の 00:00〜08:59 に
  // 1 歳少なく返っていた(2026-08)。年齢は扶養控除・健康診断の対象判定に使う。
  //
  // 引数だけを取る関数(`YYYY-MM-DD` を UTC 0 時として扱うもの)は正しいので、
  // **既定が `new Date()` であること**を条件にする。
  {
    const code = stripComments(text);
    // **`[^)]*` で引数を取らない。** `at: Date = new Date()` の `)` で切れる
    // ——同じ誤りを 2026-08 に 8 回繰り返したので `argsAt` を使う
    for (const m of code.matchAll(/export function (\w+)\(/g)) {
      const name = m[1];
      const open = m.index + m[0].length - 1;
      const args = argsAt(code, open);
      const bodyStart = code.indexOf("{", open + args.length);
      const body = bodyStart === -1 ? "" : code.slice(bodyStart, bodyStart + 700);
      if (!/=\s*new Date\(\)/.test(args)) continue;
      if (!/\.getUTC(FullYear|Month|Date|Day|Hours)\(/.test(body)) continue;
      // JST に直してから数えていれば良し
      if (/Jst|JST_OFFSET/.test(body)) continue;
      const line = code.slice(0, m.index).split("\n").length;
      hits.push(`${rel}:${line}(${name}: 既定の「今」を UTC で数えています)`);
    }
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    // コメント行は対象外。**置き換え先の説明にこの形が出てくる**ため
    // (formatDateJst の TSDoc がまさにそれで、自分自身を検出してしまう)
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    if (NOW_TO_UTC_DATE.test(line)) hits.push(`${rel}:${i + 1}`);
    // **画面は端末の TZ(=JST)で正しい。** サーバ側だけを見る
    else if (VAR_TO_UTC_DATE.test(line)) {
      hits.push(`${rel}:${i + 1}(「今日」を UTC で切り出しています。JST の早朝に 1 日ずれます)`);
    }
    else if (NOW_TO_LOCAL_PARTS.test(line) && !rel.endsWith(".tsx") && !rel.startsWith("packages/ui/")) {
      hits.push(`${rel}:${i + 1}(サーバの TZ で年月日を解釈しています)`);
    }
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
  console.log(`✅ 「今」から UTC の日付を切り出している箇所はありません(${files.length} ファイルを検査)`);
}
