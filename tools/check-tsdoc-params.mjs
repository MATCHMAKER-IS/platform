#!/usr/bin/env node
/**
 * TSDoc の `@param` が、**実装の引数と一致しているか**を検査する。
 *
 * 【なぜ要るか】
 * `check-tsdoc.mjs` は「書いてあるか」しか見ない。そのため
 * **1,833 関数が「TSDoc 完備 100%」と表示されながら、
 * 実装と食い違った説明が大量に残っていた**(2026-08 の初回計測で 666 件)。
 *
 * 無いより悪い。CLAUDE.md が書いているとおり、TSDoc は
 * 「AI も TSDoc が無いと誤った使い方を提案する」ためのものだが、
 * **間違った TSDoc は、AI にも人にも誤った使い方を確信させる**。
 * リファレンスサイト(`pnpm site`)も TSDoc から生成するので、
 * 誤りはそのまま公開される。
 *
 * 【危険度で分ける】
 *
 * | 種別 | 何が起きるか |
 * |---|---|
 * | **[P1] 並び順違い** | 型が同じだと**黙って入れ替わる**。
 *   `reconcile(invoices, payments)` を文書どおり `(payments, invoices)` と呼ぶと、結果は返るが中身が逆 |
 * | **[P2] 存在しない引数** | 文書にある引数を渡すと `TS2554`。ビルドで気づけるが、
 *   **渡せると思って設計してしまう** |
 * | **[P3] 名前だけ違い** | `seq` と `sequence` のような改名漏れ。実害は小さいが、多いと文書全体が信用されなくなる |
 * | **[P4] 存在しないプロパティ** | `@param options.foo` の `foo` が型に無い。**先頭だけ見ていると素通りする** |
 *
 * P4 の実例: `runMigrations` の `dryRun`(**本番マイグレーションを試し打ちできる**と
 * 誤解させる)、`formatMoney` の `locale`(実際は `en-US` 固定で指定できない)、
 * `createQueryCache` の `maxSize`(上限を設定できると読めるが存在しない)。
 *
 * P1・P2 は **0 を保つ**。P3 は数が多いので上限方式(増やさないことだけ守る)。
 *
 * 【検査の限界】
 * - 分割代入(`function f({ a, b })`)は対象外。名前が引数に現れないため
 * - `@param props.rows` のような入れ子は、先頭(`props`)だけを見る
 * - `_` で始まる引数(意図的な未使用)は数えない
 *
 * 実行:
 *   node tools/check-tsdoc-params.mjs             … 検査
 *   node tools/check-tsdoc-params.mjs --list      … P3 も含めて全件出す
 *   node tools/check-tsdoc-params.mjs --set-limit … P3 の上限を今の値に下げる
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools/tsdoc-params-limit.json");

/** 上限(P2 / P3 の件数)を読む。 */
function readLimits() {
  try {
    const j = JSON.parse(readFileSync(LIMIT_FILE, "utf8"));
    return { p2: j.p2 ?? 0, p3: j.p3 ?? 0, p4: j.p4 ?? 0 };
  } catch { return { p2: 0, p3: 0, p4: 0 }; }
}

/** 上限を書き換える(**減らすときだけ**)。 */
function writeLimits(p2, p3, p4) {
  writeFileSync(LIMIT_FILE, JSON.stringify({
    _comment: "TSDoc の @param が実装と違う件数の上限。増やさないための歯止め。減らしたら --set-limit で下げる。P1(並び順)は上限を持たず常に 0。",
    p2, p3, p4,
  }, null, 2) + "\n");
}

/**
 * アロー(`=>`)を無害な記号に置き換える。
 *
 * `<` `>` はジェネリクス(`Map<string, number>`)の括弧として数える必要があるが、
 * **`=>` の `>` まで閉じ括弧として数えてしまう**。
 * `fn: (n: number) => Promise<T>` で深さが 0 を割り込み、
 * そこで引数リストが終わったことになる。
 * 実際これで `retry(fn, options)` が「引数 1 個」に見え、
 * **存在するはずの `options` を「文書だけにある引数」と誤検出した**。
 */
function maskArrows(s) {
  return s.replace(/=>/g, "@@");
}

/**
 * `(` の位置から、対応する `)` までの中身を取り出す。
 *
 * **正規表現で `[^)]*` と書くと `fn: () => void` の内側の `)` で打ち切られる**。
 * 括弧は数えるしかない。
 */
function paramsAt(rawSrc, open) {
  const src = maskArrows(rawSrc);
  let depth = 0;
  let out = "";
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if ("([{<".includes(ch)) depth += 1;
    else if (")]}>".includes(ch)) {
      depth -= 1;
      if (depth === 0) return out.slice(1);
    }
    out += ch;
  }
  return null;
}

/** 最上位のカンマだけで分割する。 */
function splitTop(s) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if ("([{<".includes(ch)) depth += 1;
    else if (")]}>".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

// **`[\s\S]*?` では `*/` をまたいでしまう。**
// 直前の別のコメント(interface のメソッドなど)から始まる一致が成立し、
// **他人の @param を自分のものとして数える**。実際 `normalizeZipcode` が
// 直上の `lookup(zipcode)` の説明を拾い、名前違いとして誤検出していた。
// コメントの中に `*/` を含めない形にする。
const DOC_FN = /\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(/g;

/**
 * 名前付きの型(`interface X { … }` / `type X = { … }`)のプロパティ名を集める。
 *
 * `@param options.foo` の `foo` が**本当にその型にあるか**を見るために要る。
 * 先頭(`options`)だけを見ていると、**中身が出鱈目でも検査を通る**。
 * 実際 2026-08 に、余分な `@param` を機械的に `obj.項目` へ寄せたところ、
 * `config.dc`(実際のプロパティは `dataCenter`)のような誤りが**検査を素通り**した。
 */
// **パッケージごとに持つ。** 型名だけで引くと衝突する:
// `RetryOptions` は net / db / mail / storage / notify が別々に定義しており、
// 名前で引くと**他所の型のプロパティで検査してしまう**(実際に誤検出が出た)。
const typeProps = new Map();
// `extends` を挟む形(`interface X extends Y {`)も拾う
const TYPE_DECL = /(?:interface|type)\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?(?:=\s*)?\{([\s\S]*?)\n\}/g;
for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts"] })) {
  if (rel.includes(".test.") || rel.includes("generated")) continue;
  const pkg = rel.split("/")[1];
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of src.matchAll(TYPE_DECL)) {
    const props = new Set(
      [...m[2].matchAll(/^\s*(?:readonly\s+)?([A-Za-z0-9_]+)\s*[?:(]/gm)].map((x) => x[1]),
    );
    if (props.size === 0) continue;
    const key = `${pkg}:${m[1]}`;
    // 同じパッケージ内で同名が複数あれば、**合併して甘く**する(誤検出を出さない)
    const prev = typeProps.get(key);
    typeProps.set(key, prev ? new Set([...prev, ...props]) : props);
  }
}

/** 引数の型注釈から、プロパティ名の集合を得る(取れなければ null)。 */
function propsOfParam(decl, pkg) {
  const lit = decl.match(/:\s*\{([\s\S]*)\}\s*$/);
  if (lit) return new Set([...lit[1].matchAll(/(?:^|[{;,])\s*(?:readonly\s+)?([A-Za-z0-9_]+)\s*[?:]/g)].map((x) => x[1]));
  const named = decl.match(/:\s*([A-Za-z0-9_]+)/);
  if (named === null) return null;
  // **その型が同じパッケージで見つからないなら判定しない。**
  // 他パッケージから import した型は追えないので、黙って通す(誤検出より漏れを選ぶ)
  return typeProps.get(`${pkg}:${named[1]}`) ?? null;
}

const findings = { P1: [], P2: [], P3: [], P4: [] };
let checked = 0;

for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts"] })) {
  if (rel.includes(".test.") || rel.includes("generated")) continue;
  const src = readFileSync(path.join(ROOT, rel), "utf8");

  for (const m of src.matchAll(DOC_FN)) {
    const [doc, name] = [m[1], m[2]];
    const raw = paramsAt(src, m.index + m[0].length - 1);
    if (raw === null) continue;

    const documented = [...new Set(
      [...doc.matchAll(/@param\s+([A-Za-z0-9_.[\]]+)/g)].map((d) => d[1].split(".")[0]),
    )];
    if (documented.length === 0) continue;

    let destructured = false;
    const actual = [];
    const decls = new Map();
    for (const part of splitTop(raw)) {
      const t = part.replace(/\/\/[^\n]*/g, "").trim();
      if (!t) continue;
      if (t.startsWith("{")) { destructured = true; break; }
      const n = t.split(/[:=?]/)[0].trim();
      // `_` 始まりは「意図的に使わない引数」。説明が残っていても責めない
      if (!n.startsWith("_")) { actual.push(n); decls.set(n, t); }
    }
    if (destructured) continue;

    // `@param options.foo` の `foo` が型にあるか
    for (const d of doc.matchAll(/@param\s+([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g)) {
      const props = decls.has(d[1]) ? propsOfParam(decls.get(d[1]), rel.split("/")[1]) : null;
      if (props !== null && !props.has(d[2])) {
        findings.P4.push({ rel, name, actual: [`${d[1]}.${d[2]}`], documented: [`${d[1]} に ${d[2]} は無い`] });
      }
    }

    checked += 1;
    const entry = { rel, name, actual, documented };
    if (documented.length > actual.length) findings.P2.push(entry);
    else if (documented.join() !== actual.join()) {
      const sameSet = documented.length === actual.length
        && documented.every((d) => actual.includes(d));
      (sameSet ? findings.P1 : findings.P3).push(entry);
    }
  }
}

if (process.argv.includes("--set-limit")) {
  writeLimits(findings.P2.length, findings.P3.length, findings.P4.length);
  console.log(`✅ 上限を更新しました(P2=${findings.P2.length} / P3=${findings.P3.length} / P4=${findings.P4.length})`);
  process.exit(0);
}

const limits = readLimits();
const show = (e) => `   ${e.rel}: ${e.name}()  実装(${e.actual.join(", ")}) / 文書(${e.documented.join(", ")})`;

console.log(`TSDoc の @param を ${checked} 関数で検査しました。`);

let failed = false;

if (findings.P1.length > 0) {
  failed = true;
  console.error(`\n❌ [P1] 並び順が実装と違う ${findings.P1.length} 件`);
  console.error("   **型が同じだと黙って入れ替わります**(結果は返るが中身が違う)。");
  for (const e of findings.P1) console.error(show(e));
}

if (findings.P4.length > limits.p4) {
  failed = true;
  console.error(`\n❌ [P4] 存在しないプロパティを説明している箇所が ${findings.P4.length} 件に増えました(上限 ${limits.p4})`);
  console.error("   `@param options.foo` の foo が型にありません。**先頭だけ合っていても中身が違えば嘘です**。");
  for (const e of findings.P4.slice(0, 20)) console.error(`   ${e.rel}: ${e.name}()  ${e.documented[0]}`);
} else if (findings.P4.length > 0) {
  console.log(`⚠ [P4] 存在しないプロパティの説明が ${findings.P4.length} 件(上限 ${limits.p4}・詳細は --list)`);
  if (process.argv.includes("--list")) for (const e of findings.P4) console.log(`   ${e.rel}: ${e.name}()  ${e.documented[0]}`);
}

if (findings.P2.length > limits.p2) {
  failed = true;
  console.error(`\n❌ [P2] 実装に無い引数を説明している箇所が ${findings.P2.length} 件に増えました(上限 ${limits.p2})`);
  console.error("   文書どおりに渡すとビルドが落ちます。**渡せると思って設計してしまう**のが害。");
  for (const e of findings.P2.slice(0, 20)) console.error(show(e));
  if (findings.P2.length > 20) console.error(`   … 他 ${findings.P2.length - 20} 件`);
} else if (findings.P2.length > 0) {
  console.log(`⚠ [P2] 実装に無い引数の説明が ${findings.P2.length} 件(上限 ${limits.p2}・詳細は --list)`);
  if (process.argv.includes("--list")) for (const e of findings.P2) console.log(show(e));
}

if (findings.P3.length > limits.p3) {
  failed = true;
  console.error(`\n❌ [P3] 名前が実装と違う箇所が ${findings.P3.length} 件に増えました(上限 ${limits.p3})`);
  for (const e of findings.P3.slice(0, 10)) console.error(show(e));
} else if (findings.P3.length > 0) {
  console.log(`⚠ [P3] 名前だけの違いが ${findings.P3.length} 件(上限 ${limits.p3}・詳細は --list)`);
  if (process.argv.includes("--list")) for (const e of findings.P3) console.log(show(e));
}

if (failed) {
  console.error("\nTSDoc はリファレンスサイトにも AI の提案にも使われます。");
  console.error("**間違った説明は、無い場合より確実に誤らせます。**");
  process.exit(1);
}
console.log("✅ 並び順の食い違い(P1)はありません。P2 / P3 / P4 は上限内です");
