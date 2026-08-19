#!/usr/bin/env node
/**
 * **括弧の対応**を、依存ゼロで見張る。
 *
 * 【なぜ要るか】
 * `check-syntax` は TypeScript を使うため、依存が入っていないと skip する。
 * オフラインの環境や `pnpm install` の前は動かない。
 *
 * その隙に 2 回壊した(2026-08):
 * - 一括置換で `try {` を挿入して閉じ忘れ、**32 ファイル**
 * - `<div>` の開きだけを消して `</div>` が余り、**19 画面**
 *
 * どちらも「開いて閉じる」の数が合わないだけなので、
 * **構文解析なしで見つけられる**。tsc の代わりではなく、
 * 依存が無いときの最後の砦。
 *
 * 【何を見ないか】
 * - 型・未使用・到達不能。それは tsc の仕事
 * - **`.tsx`**。JSX の `<` を演算子と誤認し、正規表現の判別が狂う。
 *   JSX の開閉は `check-jsx-tags` が別に見ている。
 *   **誤検出は害の方が大きい**(正しいコードを直させることになる)
 *
 * ここは**確実に判定できる範囲**で、壊れているかどうかだけを見る。
 *
 *   node tools/check-braces.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { ALWAYS_SKIP } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["apps", "packages", "tools", "e2e"];

/**
 * 文字列・コメント・正規表現を空白に置き換える。
 *
 * **中身の括弧を数えないため。**
 * `"} {"` のような文字列や、`// } ` のようなコメントを数えると
 * 正しいコードを壊れていると言ってしまう。
 *
 * @param src ソース
 * @returns 括弧だけが残った文字列(位置は元のまま)
 */
function stripNonCode(src) {
  let out = "";
  let i = 0;
  let inLine = false;
  let inBlock = false;
  let quote = "";
  let inTemplate = 0;

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (inLine) {
      if (c === "\n") { inLine = false; out += c; } else out += " ";
      i += 1;
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") { inBlock = false; out += "  "; i += 2; continue; }
      out += c === "\n" ? c : " ";
      i += 1;
      continue;
    }
    if (quote !== "") {
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === quote) { quote = ""; out += " "; i += 1; continue; }
      out += c === "\n" ? c : " ";
      i += 1;
      continue;
    }
    if (inTemplate > 0) {
      // **`${...}` の中はコードなので数える。**
      if (c === "\\") { out += "  "; i += 2; continue; }
      if (c === "$" && next === "{") { inTemplate += 1; out += " {"; i += 2; continue; }
      if (c === "}" && inTemplate > 1) { inTemplate -= 1; out += "}"; i += 1; continue; }
      if (c === "`" && inTemplate === 1) { inTemplate = 0; out += " "; i += 1; continue; }
      out += c === "\n" ? c : " ";
      i += 1;
      continue;
    }

    if (c === "/" && next === "/") { inLine = true; out += "  "; i += 2; continue; }
    if (c === "/" && next === "*") { inBlock = true; out += "  "; i += 2; continue; }

    // **正規表現リテラルを飛ばす。**
    // `/\)/` のような中身を数えると、正しいコードを壊れていると言う。
    //
    // 割り算との区別は文脈が要る(`a / b`)。ここでは
    // **直前が演算子や開き括弧なら正規表現**という近似で判断する。
    // 誤って割り算を飛ばしても、括弧の数は変わらないので害が無い。
    if (c === "/") {
      const head = out.replace(/\s+$/, "");
      const before = head.slice(-1);
      // **キーワードの直後も正規表現。** `return /…/` `typeof /…/` `case /…/` は
      // 直前が英字なので、記号だけを見ていると**割り算と誤認して飛ばさない**
      // ——中身の `[^{;]` を実コードとして数え、**正しい行を壊れていると言う**
      // (2026-08 に `check-build-ready` で実際に起きた)。
      const afterKeyword = /\b(return|typeof|case|in|of|instanceof|new|delete|void|do|else|yield|await)$/.test(head);
      if (before === "" || afterKeyword || "=(,:[!&|?{;+*%<>~^".includes(before)) {
        let j = i + 1;
        let closed = false;
        let inClass = false;
        while (j < src.length) {
          const d = src[j];
          if (d === "\\") { j += 2; continue; }
          if (d === "\n") break;            // 改行を跨ぐ正規表現は無い
          // **文字クラスの中では `/` も `]` も普通の文字。**
          // `/[".*+?^${}()|[\]\\]/` のような正規表現で、
          // クラス内の `/` を閉じと誤認していた
          if (d === "[" && !inClass) inClass = true;
          else if (d === "]" && inClass) inClass = false;
          else if (d === "/" && !inClass) { closed = true; j += 1; break; }
          j += 1;
        }
        if (closed) {
          out += " ".repeat(j - i);
          i = j;
          continue;
        }
      }
    }
    if (c === '"' || c === "'") { quote = c; out += " "; i += 1; continue; }
    if (c === "`") { inTemplate = 1; out += " "; i += 1; continue; }

    out += c;
    i += 1;
  }
  return out;
}

/**
 * 括弧の対応を調べる。
 *
 * @param src ソース
 * @param bracesOnly `{}` だけを見る(`.tsx` 用。丸括弧は JSX と判別が付かない)
 * @returns 問題があれば説明、無ければ null
 */
function checkBraces(src, bracesOnly = false) {
  const code = stripNonCode(src);
  const pairs = bracesOnly ? { "}": "{" } : { "}": "{", ")": "(", "]": "[" };
  const stack = [];
  let line = 1;

  for (let i = 0; i < code.length; i += 1) {
    const c = code[i];
    if (c === "\n") { line += 1; continue; }
    const opens = bracesOnly ? "{" : "{([";
    const closes = bracesOnly ? "}" : "})]";
    if (opens.includes(c)) { stack.push({ c, line }); continue; }
    if (closes.includes(c)) {
      const top = stack.pop();
      if (top === undefined) return `${line} 行目: 閉じ \`${c}\` が余っています`;
      if (top.c !== pairs[c]) {
        return `${line} 行目: \`${top.c}\`(${top.line} 行目)に対して \`${c}\` で閉じています`;
      }
    }
  }
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    return `${top.line} 行目の \`${top.c}\` が閉じられていません`;
  }
  return null;
}

/** 対象ファイルを集める。 */
function collect(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (ALWAYS_SKIP.has(e.name)) continue;
      collect(path.join(dir, e.name), acc);
    // **`.tsx` は対象外。**
    // JSX の `<` を演算子と誤認し、正規表現の判別が狂う。
    // JSX の開閉は `check-jsx-tags` が別に見ているので、
    // ここは**確実に判定できる範囲**に絞る(誤検出は害の方が大きい)。
    // **`.tsx` は対象外。**
    // 中括弧だけなら見られると考えて試したが、
    // JSX 内のテンプレート文字列や型注釈で 22 件の誤検出が出た。
    // **誤検出は正しいコードを直させる**ので、害の方が大きい。
    //
    // `.tsx` の閉じ忘れは `check-jsx-tags`(タグの対応)と
    // `check-build-ready` が拾う。それでも漏れるなら tsc に任せる。
    } else if (/\.(ts|mjs|mts)$/.test(e.name)) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));

/**
 * 前回「問題なし」と判定した内容のハッシュ。
 *
 * **1 文字ずつ 2 回走査するので遅い**(1,671 ファイル / 7.8MB = 約 1,600 万回。実測 71 秒)。
 * 内容が変わっていないファイルは結果も変わらないので、飛ばしてよい。
 *
 * **ハッシュで見る**(更新時刻ではなく)。checkout やコピーで時刻だけ変わることがあり、
 * そのたびに全件走らせては意味がない。逆に**内容が同じなら結果は必ず同じ**。
 *
 * キャッシュが壊れていても**多めに走るだけ**で、見落としは起きない。
 */
const cacheFile = path.join(ROOT, "node_modules", ".cache", "braces-ok.json");
const prev = (() => {
  try { return JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch { return {}; }
})();
const next = {};

const broken = [];
let skipped = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  const hash = createHash("sha1").update(src).digest("hex");
  if (prev[rel] === hash) {
    next[rel] = hash;
    skipped += 1;
    continue;
  }
  // **`.tsx` は中括弧だけ。** 丸括弧は JSX と正規表現の判別が付かない
  const bracesOnly = f.endsWith(".tsx");
  const message = checkBraces(src, bracesOnly);
  if (message !== null) broken.push(`${rel}: ${message}`);
  else next[rel] = hash;
}
try {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(next));
} catch { /* 書けなくても検査は成立する */ }

/**
 * 判定しきれない既知のファイル。
 *
 * **正規表現が入り組んでいて、割り算との区別が付かない。**
 * `/[".*+?^${}()|[\]\\]/` のように、文字クラスの中に括弧と
 * エスケープが混ざるもの。tsc なら正しく読めるので、
 * ここで無理をせず**除外して理由を残す**方が安全
 * (誤検出は正しいコードを直させることになる)。
 */
const KNOWN_HARD = [
  "packages/csv/src/index.ts",
  "packages/report/src/reports.ts",
  "apps/internal-app/src/server/reports.ts",
];

const real = broken.filter((b) => !KNOWN_HARD.some((k) => b.startsWith(k)));

if (real.length > 0) {
  console.error("❌ 括弧の対応が合っていません(ビルドが構文エラーで落ちます)\n");
  for (const b of real.slice(0, 20)) console.error(`   ${b}`);
  if (real.length > 20) console.error(`   … 他 ${real.length - 20} 件`);
  process.exit(1);
}

// **「何件を実際に見たか」を出す。** キャッシュで飛ばした分を「検査」と書くと、
// 走査量の報告が実態とずれる(`check-scan-reporting` が見張っているのはこの数字)
console.log(`✅ 括弧の対応は合っています(${files.length - skipped} / ${files.length} ファイルを走査`
  + `${skipped > 0 ? `・${skipped} 件は前回から変更なし` : ""}`
  + `${KNOWN_HARD.length > 0 ? ` / 判定しきれない ${KNOWN_HARD.length} 件は除外` : ""})`);
