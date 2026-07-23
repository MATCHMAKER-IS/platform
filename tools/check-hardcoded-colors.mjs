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
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.tsx$/.test(e.name) && !e.name.endsWith(".test.tsx")) out.push(fp);
  }
  return out;
}

const files = collect(path.join(ROOT, "packages/ui/src"));
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
  console.log(`✅ 上限を ${total} に更新しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const r of rows) console.log(`  ${String(r.count).padStart(3)} 箇所  ${r.rel}  (${r.sample.join(", ")})`);
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

console.log("✅ UI 部品に直書きされた色はありません");
process.exit(0);
