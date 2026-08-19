/**
 * UI 部品の中に**色を直書きしていないか**を検査する。
 *
 * `bg-slate-100` のように書くと、**テーマを切り替えても変わらない**。
 * 実際に、濃色サイドバーのテーマを足したとき、選択中の項目だけが
 * 白いまま残って読めなくなった(`nav-menu` の `bg-slate-100`)。
 *
 * 色はテーマのトークン(`var(--color-…)`)から取る。
 * どうしても固定色が要る場所(下記)は ALLOW に理由付きで登録する。
 *
 * 一度に直せないため**上限方式**にする。増やさないことだけを守り、
 * 直したら上限を下げる。
 *
 * 実行:
 *   node tools/check-hardcoded-colors.mjs            … 上限と比べる
 *   node tools/check-hardcoded-colors.mjs --list     … 多い順に一覧
 *   node tools/check-hardcoded-colors.mjs --set-limit … 直したら上限を下げる
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

let scanned = 0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = new URL("./hardcoded-colors-limit.json", import.meta.url);

/** Tailwind の色クラス(`bg-slate-100` など)。 */
const COLOR_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:slate|gray|neutral|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/**
 * 固定色を許す場所。**理由を書くこと。**
 *
 * 状態色(成功・警告・エラー)は、テーマを変えても意味が変わらない方が安全
 * (赤が「成功」に見えるテーマを作れてしまうと事故になる)。
 */
const ALLOW = {
  "alert.tsx": "状態色(情報・成功・注意・エラー)は、テーマによらず意味を固定する",
  "badge.tsx": "状態色は、テーマによらず意味を固定する",
  "toast.tsx": "状態色は、テーマによらず意味を固定する",
  "error-boundary.tsx": "異常時の表示。テーマの読み込み前でも見える必要がある",
};

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
  scanned += 1;
    if (ALWAYS_SKIP.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx$/.test(e.name) && !e.name.endsWith(".test.tsx")) out.push(fp);
  }
  return out;
}

// **基盤とアプリを分けて数える。**
// 基盤(packages/ui)は部品として全画面に影響するので 0 を保つ。
// アプリ・デモは画面固有の色付けもあるため、上限方式で増やさないことだけを守る。
// 混ぜて 1 つの上限にすると、アプリで増やした分だけ基盤で増やせてしまう。
const uiFiles = collect(path.join(ROOT, "packages/ui/src"));
const appFiles = [
  ...collect(path.join(ROOT, "apps")),
];
const files = uiFiles;
const rows = [];
let total = 0;

for (const f of files) {
  const base = path.basename(f);
  if (ALLOW[base]) continue;
  const hits = readFileSync(f, "utf8").match(COLOR_CLASS) ?? [];
  if (hits.length === 0) continue;
  rows.push({ rel: path.relative(ROOT, f).replace(/\\/g, "/"), count: hits.length, sample: [...new Set(hits)].slice(0, 3) });
  total += hits.length;
}
rows.sort((a, b) => b.count - a.count);

// アプリ・デモ側も同じ規則で数える(上限は別に持つ)
const appRows = [];
let appTotal = 0;
for (const f of appFiles) {
  const base = path.basename(f);
  if (ALLOW[base]) continue;
  const hits = readFileSync(f, "utf8").match(COLOR_CLASS) ?? [];
  if (hits.length === 0) continue;
  appRows.push({ rel: path.relative(ROOT, f).replace(/\\/g, "/"), count: hits.length, sample: [...new Set(hits)].slice(0, 3) });
  appTotal += hits.length;
}
appRows.sort((a, b) => b.count - a.count);

const APP_LIMIT_FILE = new URL("./hardcoded-colors-app-limit.json", import.meta.url);
function readAppLimit() {
  try {
    return JSON.parse(readFileSync(APP_LIMIT_FILE, "utf8")).limit ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function readLimit() {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "UI 部品の中に直書きされた色クラスの数。テーマを切り替えても変わらないため、増やさない。状態色など意図的なものは check-hardcoded-colors.mjs の ALLOW へ理由付きで登録する。",
    limit: total,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  writeFileSync(APP_LIMIT_FILE, `${JSON.stringify({
    _comment: "アプリ・デモの中に直書きされた色クラスの数。基盤(packages/ui)とは別に数える(混ぜるとアプリで増やした分だけ基盤で増やせてしまう)。増やさないことだけを守る。",
    limit: appTotal,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を更新しました(基盤 ${total} / アプリ ${appTotal})`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const r of rows) console.log(`  ${String(r.count).padStart(3)} 箇所  ${r.rel}  (${r.sample.join(", ")})`);
  if (appRows.length > 0) {
    console.log("  --- アプリ・デモ ---");
    for (const r of appRows.slice(0, 20)) console.log(`  ${String(r.count).padStart(3)} 箇所  ${r.rel}  (${r.sample.join(", ")})`);
  }
}

const limit = readLimit();
if (total > limit) {
  console.log(`❌ 直書きされた色が ${total} 箇所に増えました(上限 ${limit})。`);
  console.log("   テーマを切り替えても変わりません。var(--color-…) を使ってください。");
  console.log("   意味を固定したい状態色なら、ALLOW に理由付きで登録してください。");
  console.log("   一覧: node tools/check-hardcoded-colors.mjs --list");
  process.exit(1);
}

if (total > 0) {
  console.log(`⚠ 直書きされた色が ${total} 箇所あります(上限 ${limit}・${rows.length} ファイル)`);
  if (total < limit) console.log(`   ${limit - total} 箇所減りました。--set-limit で上限を下げてください`);
  process.exit(0);
}

const appLimit = readAppLimit();
if (appTotal > appLimit) {
  console.log(`❌ アプリ・デモの直書き色が ${appTotal} 箇所に増えました(上限 ${appLimit})。`);
  console.log("   一覧: node tools/check-hardcoded-colors.mjs --list");
  process.exitCode = 1;
} else if (appTotal > 0) {
  console.log(`⚠ アプリ・デモの直書き色が ${appTotal} 箇所あります(上限 ${appLimit}・${appRows.length} ファイル)`);
  if (appTotal < appLimit) console.log(`   ${appLimit - appTotal} 箇所減りました。--set-limit で上限を下げてください`);
}

// **最終行に要約を出す。** preflight は最後の行だけを一覧に載せるので、
// ここでアプリ側の状況も伝えないと警告が埋もれる。
// ただし**上限超過のときは ✅ を出さない**(最終行が緑だと、赤い行が埋もれる)。
if (process.exitCode === 1) {
  console.log(`❌ アプリ・デモの直書き色が上限を超えています(${appTotal} > ${appLimit})`);
} else if (appTotal > 0) {
  console.log(`✅ UI 部品に直書きされた色はありません(アプリ・デモは ${appTotal} 箇所・上限 ${appLimit})`);
} else {
  console.log(`✅ 直書きされた色はありません(基盤・アプリとも / ${scanned} ファイルを検査)`);
}
// **`process.exit(0)` で終わらない。** exitCode を上書きしてしまい、
// 上限超過を検出しても呼び出し側は成功と受け取る(実際にそうなっていた)。
