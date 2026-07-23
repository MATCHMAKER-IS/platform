/**
 * アクセシビリティ(a11y)の静的検査。
 *
 * 社内システムは「毎日・長時間・キーボード中心」で使われるため、
 * マウス前提の実装や読み上げ不能な要素は、そのまま業務効率の低下になる。
 * ブラウザを起動せずに検出できる代表的な違反だけを、確実に拾う。
 *
 * 検査するもの(いずれも「直せば必ず良くなる」ものに限定):
 *  A11Y001 <img> に alt が無い            … 読み上げ時に無音・ファイル名読み上げになる
 *  A11Y002 div/span に onClick だけ付いている … Tab で到達できず Enter で押せない
 *  A11Y003 正の tabIndex                  … Tab 順が DOM と食い違い、操作不能になりやすい
 *  A11Y004 <html> に lang が無い          … 読み上げの言語が誤判定される
 *  A11Y005 アイコンだけのボタンに名前が無い … 「ボタン」としか読まれず用途が分からない
 *
 * 実行: node tools/check-a11y.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIRS = ["apps", "demos"];

/** 走査対象の .tsx を集める。 */
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * コメントを除去する(JSX 内の文字列は残す)。
 * 行番号がズレると指摘が使い物にならないため、改行の数は保ったまま中身だけ消す。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/([^:])\/\/[^\n]*/g, "$1");
}

/**
 * `<tag` の開始位置から、属性内の文字列・波括弧を考慮して本当の `>` を探す。
 * 属性値の中の `>`(アロー関数 `=>` など)で切ってしまう誤検出を避ける。
 */
function readTag(src, start) {
  let i = start, quote = null, depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return { text: src.slice(start, i + 1), end: i + 1 };
    i++;
  }
  return null;
}

/** src 中の `<tag ...>` をすべて返す。 */
function findTags(src, tag) {
  const found = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m;
  while ((m = re.exec(src)) !== null) {
    if (insideString(src, m.index)) continue;
    const t = readTag(src, m.index);
    if (t) found.push({ tag: t.text, index: m.index, end: t.end });
  }
  return found;
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/**
 * その位置が「文字列リテラルの中」かを行内で判定する。
 * 例: XSS デモの `'<img src=x onerror=...>'` は JSX ではなく文字列なので検査対象外。
 * 行をまたぐテンプレートは判定できないが、その場合は見逃すだけ(誤検出はしない)側に倒す。
 */
function insideString(src, index) {
  const lineStart = src.lastIndexOf("\n", index - 1) + 1;
  const before = src.slice(lineStart, index);
  for (const q of ['"', "'", "`"]) {
    let n = 0;
    for (let i = 0; i < before.length; i++) if (before[i] === q && before[i - 1] !== "\\") n++;
    if (n % 2 === 1) return true;
  }
  return false;
}

/** 名前(読み上げ用のラベル)を持つか。 */
const hasName = (t) => /\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/.test(t);

// 絵文字・記号だけの中身か(アイコンのみのボタン判定)
const ICON_ONLY = /^[\s\p{Emoji}\p{S}\u200d\ufe0f×✕✖←→↑↓▶◀]+$/u;

const violations = [];
const add = (file, line, code, msg) => violations.push({ file: path.relative(ROOT, file), line, code, msg });

for (const dir of TARGET_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;

  for (const file of collect(abs)) {
    const raw = fs.readFileSync(file, "utf8");
    const src = stripComments(raw);

    // A11Y001: img に alt が無い
    for (const { tag, index } of findTags(src, "img")) {
      if (!/\balt\s*=/.test(tag)) add(file, lineOf(src, index), "A11Y001", "<img> に alt がありません(装飾なら alt=\"\" を明示)");
    }

    // A11Y002: div/span の onClick(role も無い)
    for (const t of ["div", "span"]) {
      for (const { tag, index } of findTags(src, t)) {
        if (!/\bonClick\s*=/.test(tag)) continue;
        // role を付ける / aria-hidden(背景オーバーレイ等)なら意図的とみなす
        if (/\brole\s*=|\baria-hidden\s*=/.test(tag)) continue;
        add(file, lineOf(src, index), "A11Y002", `<${t}> に onClick があります(button を使うか role と keyboard 操作を付ける)`);
      }
    }

    // A11Y003: 正の tabIndex
    for (const m of src.matchAll(/tabIndex\s*=\s*\{\s*([1-9]\d*)\s*\}/g)) {
      if (insideString(src, m.index)) continue;
      add(file, lineOf(src, m.index), "A11Y003", `正の tabIndex(${m[1]})は Tab 順を壊します(0 か -1 にする)`);
    }

    // A11Y004: html に lang が無い
    for (const { tag, index } of findTags(src, "html")) {
      if (!/\blang\s*=/.test(tag)) add(file, lineOf(src, index), "A11Y004", "<html> に lang がありません(lang=\"ja\")");
    }

    // A11Y005: アイコンだけのボタンに名前が無い
    for (const { tag, index, end } of findTags(src, "button")) {
      if (hasName(tag) || /\/>$/.test(tag)) continue;
      const close = src.indexOf("</button>", end);
      if (close === -1) continue;
      const inner = src.slice(end, close).trim();
      if (inner === "" || !ICON_ONLY.test(inner)) continue;
      add(file, lineOf(src, index), "A11Y005", `アイコンだけのボタン(${inner})に名前がありません(aria-label か title)`);
    }
  }
}

if (violations.length === 0) {
  console.log("✅ アクセシビリティの静的検査に違反はありません(img/クリック可能要素/tabIndex/lang/アイコンボタン)");
  process.exit(0);
}

for (const v of violations) console.log(`❌ ${v.file}:${v.line} [${v.code}] ${v.msg}`);
console.log(`❌ アクセシビリティ違反が ${violations.length} 件。キーボード操作・読み上げが壊れます。`);
process.exit(1);
