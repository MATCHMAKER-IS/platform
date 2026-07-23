/**
 * 保守しやすさの検査(ファイルの大きさ・1 行の長さ)。
 *
 * 動くかどうかは他の検査が見る。ここが見るのは**次に触る人が読めるか**。
 *
 * 実測して分かったこと:
 *   - `tools/smoke.mjs` は 12,000 行を超え、**1 行 900 文字**の箇所があった
 *   - 長い行は、編集のたびに置換を失敗させる(実際に何度も起きた)
 *   - 大きなファイルは、どこを直せばよいか探すだけで時間がかかる
 *
 * 一度に直せないため**上限方式**にする。今より悪くしないことだけを守り、
 * 直したら上限を下げる。
 *
 * 実行:
 *   node tools/check-maintainability.mjs            … 上限と比べる
 *   node tools/check-maintainability.mjs --list     … 大きいものを一覧
 *   node tools/check-maintainability.mjs --set-limit … 直したら上限を下げる
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = new URL("./maintainability-limit.json", import.meta.url);

/** 1 ファイルの行数の目安。超えたら分割を考える。 */
const MAX_LINES = 600;
/** 1 行の長さの目安。超えると差分が読めず、編集も失敗しやすい。 */
const MAX_LINE_LENGTH = 200;

/** 検査対象。生成物とテストは対象外(機械が作る・長くても読まない)。 */
const IGNORE = [
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
  /[\\/]dist[\\/]/,
  /docs[\\/]platform[\\/]/,
];

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.(ts|tsx|mjs|mts)$/.test(e.name)) out.push(fp);
  }
  return out;
}

const files = [
  ...collect(path.join(ROOT, "packages")),
  ...collect(path.join(ROOT, "apps")),
  ...collect(path.join(ROOT, "demos")),
  ...collect(path.join(ROOT, "tools")),
];

const bigFiles = [];
let longLineCount = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (IGNORE.some((re) => re.test(rel))) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  if (lines.length > MAX_LINES) bigFiles.push({ rel, lines: lines.length });
  longLineCount += lines.filter((l) => l.length > MAX_LINE_LENGTH).length;
}

bigFiles.sort((a, b) => b.lines - a.lines);

function readLimits() {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8"));
  } catch {
    return { bigFiles: Number.MAX_SAFE_INTEGER, longLines: Number.MAX_SAFE_INTEGER };
  }
}

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: `${MAX_LINES} 行を超えるファイル数と、${MAX_LINE_LENGTH} 文字を超える行数の上限。増やさないための歯止め。減らしたら --set-limit で下げる。`,
    bigFiles: bigFiles.length,
    longLines: longLineCount,
    updatedAt: new Date().toISOString().slice(0, 10),
  }, null, 2)}\n`);
  console.log(`✅ 上限を更新しました(大きいファイル ${bigFiles.length} / 長い行 ${longLineCount})`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  console.log(`${MAX_LINES} 行を超えるファイル:`);
  for (const b of bigFiles) console.log(`  ${String(b.lines).padStart(6)} 行  ${b.rel}`);
}

const limits = readLimits();
const summary = `${MAX_LINES}行超のファイル ${bigFiles.length} 件 / ${MAX_LINE_LENGTH}文字超の行 ${longLineCount} 行`;

const over = [];
if (bigFiles.length > limits.bigFiles) over.push(`大きいファイルが ${bigFiles.length} 件に増えました(上限 ${limits.bigFiles})`);
if (longLineCount > limits.longLines) over.push(`長い行が ${longLineCount} 行に増えました(上限 ${limits.longLines})`);

if (over.length > 0) {
  for (const o of over) console.log(`❌ ${o}`);
  console.log("   大きいファイルは分割を、長い行は改行を検討してください(次に触る人が読めなくなります)。");
  console.log("   一覧: node tools/check-maintainability.mjs --list");
  process.exit(1);
}

if (bigFiles.length > 0 || longLineCount > 0) {
  console.log(`⚠ ${summary}(上限内)`);
  if (bigFiles.length < limits.bigFiles || longLineCount < limits.longLines) {
    console.log("   減りました。node tools/check-maintainability.mjs --set-limit で上限を下げてください");
  }
  process.exit(0);
}

console.log(`✅ 読みにくい箇所はありません(${files.length} ファイル検査)`);
process.exit(0);
