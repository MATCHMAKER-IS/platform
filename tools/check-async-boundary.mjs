#!/usr/bin/env node
/**
 * **`AsyncBoundary` に渡す中身が、判定より先に評価されていないか**を見る。
 *
 * 【何が起きるか】
 *
 * ```tsx
 * <AsyncBoundary loading={data === null} error={error} onRetry={load}>
 *   <p>{data.total} 件</p>      ← ここで落ちる
 * </AsyncBoundary>
 * ```
 *
 * **JSX の子要素は「引数」なので、先に作られる。**
 * `AsyncBoundary` が「読み込み中」を返すかどうかを決めるより前に `data.total` が
 * 評価され、`data` が `null` のままなら **画面ごと落ちる**。
 *
 * 「読み込み中…」が出るはずの場面で**白い画面**になるので、
 * 見た目からは通信の失敗と区別がつかない。
 *
 * 【正しい形】
 *
 * ```tsx
 * if (data === null) {
 *   return <AsyncBoundary loading={error === ""} error={error} onRetry={load} />;
 * }
 * return (
 *   <AsyncBoundary loading={false} error={error} onRetry={load}>
 *     <p>{data.total} 件</p>
 *   </AsyncBoundary>
 * );
 * ```
 *
 * **早期 return が要点。** `AsyncBoundary` 側では止められない。
 *
 * 【なぜ検査にするか】
 * 2026-08 の型検査で **7 画面**が同じ形だった(会計・分析・資金繰り・CMS・
 * ダッシュボード・概況・学習)。うち 1 画面には**同じ趣旨の警告コメントが
 * 既に書いてあった**のに、他へは伝わっていなかった。
 * **書いて伝わらないなら、機械に見張らせるしかない。**
 *
 * 型検査でも `'data' is possibly 'null'` として出るが、
 * **`data!` や `as` で黙らせると消える**。こちらは書き方で見る。
 *
 * 実行: node tools/check-async-boundary.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。**基盤(部品側)は対象外**——使う側の問題なので。 */
const DIRS = ["apps"];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "generated"]);

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

/**
 * `<AsyncBoundary …>` の開きタグの終わり(`>`)を返す。
 *
 * **文字列・テンプレート・`{}` の入れ子を数える。** 属性に
 * `className={cond ? "a>b" : ""}` のような値が入るので、
 * 最初の `>` で切ると誤る。
 *
 * @param text ソース
 * @param start `<AsyncBoundary` の位置
 * @returns `>` の位置(見つからなければ -1)と、自己閉じかどうか
 */
function openTagEnd(text, start) {
  let i = start;
  let depth = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote !== null) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) {
      return { end: i, selfClosing: text[i - 1] === "/" };
    }
    i += 1;
  }
  return { end: -1, selfClosing: false };
}

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));
const offenders = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const body = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  if (!body.includes("<AsyncBoundary")) continue;

  let from = 0;
  for (;;) {
    const open = body.indexOf("<AsyncBoundary", from);
    if (open < 0) break;
    const { end, selfClosing } = openTagEnd(body, open);
    if (end < 0) break;
    from = end + 1;

    const tag = body.slice(open, end);
    // **`loading={<変数> === null}` の形だけを見る。**
    // `loading={false}`(早期 return 済み)や `loading={rows.length === 0}` は対象外
    const m = tag.match(/loading=\{\s*([A-Za-z_$][\w$]*)\s*===\s*null\s*\}/);
    if (m === null) continue;
    const varName = m[1];

    // 子要素を持たないなら安全(まさに早期 return の形)
    if (selfClosing) continue;

    const close = body.indexOf("</AsyncBoundary>", end);
    const children = body.slice(end + 1, close < 0 ? body.length : close);

    // 子要素の中でその変数を辿っていれば、判定より先に評価される。
    // **`data?.` は対象外**(辿らずに undefined になるので落ちない)。
    // **`data!.` は対象**——型検査を黙らせているだけで、実行時には落ちる。
    const deref = new RegExp(`\\b${varName}\\s*(?:!\\s*)?[.[]`);
    const at = children.search(deref);
    if (at < 0) continue;

    // **中で自分で守っているなら安全。**
    // `{data !== null && (…)}` / `{data && (…)}` / `{data ? … : …}` の形は、
    // 二重になってはいるが**落ちない**。ここで赤にすると誤検出になり、
    // 誤検出の多い検査は**そのうち誰も見なくなる**。
    // **守り方は 1 つではない。** 次のどれでも「落ちない」:
    //   {data !== null && …}        … 非 null を確かめてから
    //   {data && …}                 … 真のときだけ
    //   {data === null ? … : data.x} … **null 側を先に書く三項**(2026-08 に取りこぼしていた)
    //   {data ? data.x : …}         … 真偽の三項
    // **安全な書き方を赤にすると、この検査ごと信用されなくなる。**
    const guard = new RegExp(
      `\\b${varName}\\s*(?:[!=]==?\\s*(?:null|undefined)|&&|\\?[^.])`,
    );
    const guardAt = children.search(guard);
    if (guardAt >= 0 && guardAt < at) continue;

    const lineNo = body.slice(0, open).split("\n").length;
    offenders.push({ where: `${rel}:${lineNo}`, varName });
  }
}

if (offenders.length === 0) {
  console.log(`✅ AsyncBoundary の中身は判定より先に評価されていません(${files.length} ファイルを検査)`);
  process.exit(0);
}

console.error(`❌ AsyncBoundary の中身が判定より先に評価されています(${offenders.length} 件 / ${files.length} ファイルを検査):`);
for (const o of offenders) {
  console.error(`   ${o.where}: 子要素の中で \`${o.varName}\` を辿っています`);
}
console.error("");
console.error("   **JSX の子要素は引数なので、部品が判断する前に作られます。**");
console.error("   `AsyncBoundary` 側では止められません。**早期 return** にしてください:");
console.error("");
console.error('     if (data === null) {');
console.error('       return <AsyncBoundary loading={error === ""} error={error} onRetry={() => void load()} />;');
console.error("     }");
console.error("");
console.error("   残す側の `loading` は `false` で構いません(ここまで来たら読み込みは終わっています)。");
process.exit(1);
