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
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = new URL("./maintainability-limit.json", import.meta.url);

/** 1 ファイルの行数の目安。超えたら分割を考える。 */
const MAX_LINES = 600;
/** 1 行の長さの目安。超えると差分が読めず、編集も失敗しやすい。 */
const MAX_LINE_LENGTH = 200;
/**
 * **これを超えたら 1 件でも止める**長さ。
 *
 * 200 文字超は 1,370 件あり上限方式で管理しているが、
 * **500 文字を超える行は別物**——画面に収まらず、
 * **差分が「1 行変わった」としか出ない**ので、レビューで中身を確かめられない。
 * 2026-08 の時点で最長 858 文字、500 超が 6 件あった。
 * **閾値は 860**(最長より少しだけ上)——これ以上長い行を書いたら止まる。
 *
 * **上限方式にしない**のは、この長さが「うっかり」でしか生まれないため
 * ——意図して 500 文字の行を書く理由が無い。
 */
const HARD_MAX_LINE_LENGTH = 860;

/** 検査対象。生成物とテストは対象外(機械が作る・長くても読まない)。 */
const IGNORE = [
  /\.test\.tsx?$/,
  /\.generated\.ts$/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.next[\\/]/,
  /[\\/]dist[\\/]/,
  /docs[\\/]platform[\\/]/,
  // 生成物(Prisma の src/generated/prisma など)。人が書いたものではない
  /[\\/]generated[\\/]/,
];

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (ALWAYS_SKIP.has(e.name)) continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, out);
    else if (/\.(ts|tsx|mjs|mts)$/.test(e.name)) out.push(fp);
  }
  return out;
}

const files = [
  ...collect(path.join(ROOT, "packages")),
  ...collect(path.join(ROOT, "apps")),
  ...collect(path.join(ROOT, "tools")),
];

const bigFiles = [];
let longLineCount = 0;
/** **900 文字を超える行**(1 件でも失敗させる)。 */
const hardLongLines = [];

for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (IGNORE.some((re) => re.test(rel))) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  if (lines.length > MAX_LINES) bigFiles.push({ rel, lines: lines.length });
  longLineCount += lines.filter((l) => l.length > MAX_LINE_LENGTH).length;
  // **極端に長い行は 1 件でも止める**(差分が読めず、レビューできない)
  for (let i = 0; i < lines.length; i += 1) {
    if ((lines[i] ?? "").length > HARD_MAX_LINE_LENGTH) {
      hardLongLines.push({ file: rel, line: i + 1, length: lines[i].length });
    }
  }
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
    // **減ったときは自分で下げる。**
    // 手で `--set-limit` を叩かせると忘れ、上限だけが緩いまま残る。
    // **増えたときは止める**(こちらは判断が要るので自動化しない)。
    //
    // `--no-ratchet` で止められる(CI で意図せず書き換えないため)。
    if (!process.argv.includes("--no-ratchet")) {
      writeFileSync(LIMIT_FILE, `${JSON.stringify({
        _comment: `${MAX_LINES} 行を超えるファイル数と、${MAX_LINE_LENGTH} 文字を超える行数の上限。増やさないための歯止め。減らしたら自動で下がる。`,
        bigFiles: bigFiles.length,
        longLines: longLineCount,
      }, null, 2)}\n`);
      console.log(`   減ったので上限を下げました(大きいファイル ${bigFiles.length} / 長い行 ${longLineCount})`);
    } else {
      console.log("   減りました。node tools/check-maintainability.mjs --set-limit で上限を下げてください");
    }
  }
  process.exit(0);
}

// **900 文字を超える行は 1 件でも失敗**(上限方式にしない)。
// 画面に収まらず、**差分が「1 行変わった」としか出ない**のでレビューできない。
// 意図して書く理由が無いので、うっかりを止める
if (hardLongLines.length > 0) {
  console.error(`❌ ${HARD_MAX_LINE_LENGTH} 文字を超える行が ${hardLongLines.length} 件あります`);
  for (const h of hardLongLines.slice(0, 10)) {
    console.error(`   ${h.file}:${h.line}  ${h.length} 文字`);
  }
  console.error("");
  console.error("**差分が「1 行変わった」としか出ない**ので、レビューで中身を確かめられません。");
  console.error("改行を入れて分けてください。");
  process.exit(1);
}

console.log(`✅ 読みにくい箇所はありません(${files.length} ファイル検査)`);
process.exit(0);
