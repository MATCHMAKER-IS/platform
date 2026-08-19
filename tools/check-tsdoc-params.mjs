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
import { stripComments } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools/tsdoc-params-limit.json");

/** 上限(P2 / P3 の件数)を読む。 */
function readLimits() {
  try {
    const j = JSON.parse(readFileSync(LIMIT_FILE, "utf8"));
    return { p2: j.p2 ?? 0, p3: j.p3 ?? 0, p4: j.p4 ?? 0, p5: j.p5 ?? 0 };
  } catch { return { p2: 0, p3: 0, p4: 0, p5: 0 }; }
}

/** 上限を書き換える(**減らすときだけ**)。 */
function writeLimits(p2, p3, p4) {
  // **`p5` も必ず書く。** 書かないと `--set-limit` を走らせるたびに
  // **`p5` の行が消え**、次から既定値 0 に戻る——たまたま 0 なので
  // 気づきませんが、**上限を持たせたくなった日に静かに壊れます**(2026-08)。
  writeFileSync(LIMIT_FILE, JSON.stringify({
    _comment: "TSDoc の @param が実装と違う件数の上限。増やさないための歯止め。減らしたら --set-limit で下げる。P1(並び順)と P5(同じ引数を 2 回)は上限を持たず常に 0。",
    p2, p3, p4, p5: 0,
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
  // **文字列の中のカンマで切らない。**
  // `csvEscape(value, delimiter = ",")` の既定値には**カンマそのもの**が入る。
  // 括弧の深さだけを見ていると、ここで切れて**引数が 3 つある**ように読める
  // ——正しく書いてある関数が「説明が足りない」と指摘されていた(2026-08)。
  let quote = "";
  let escaped = false;
  for (const ch of s) {
    if (quote !== "") {
      cur += ch;
      // **`\,` のような打ち消しを飛ばす。** 打ち消された引用符で
      // 文字列が終わったと誤認すると、そこから先が全部ずれる
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue; }
    // **`=>` の `>` は閉じ括弧ではない。**
    // `pick: (tx) => X` を数えると**深さが負になり、以降の区切りがずれます**
    // ——`(db, pick, rows)` が 2 つに見えていました。
    // かといって `<` `>` を無視すると、今度は `Map<string, number>` が
    // **2 つに割れます**。**直前が `=` のときだけ数えない**のが正解(2026-08)。
    if ("([{<".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (ch === ">" && !cur.endsWith("=")) depth -= 1;
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
// `extends` を挟む形(`interface X extends Y {`)も拾う。
//
// **1 行で書かれた型も拾う。** 2026-08 まで終端を `\n}` に固定しており、
// `export interface FormatNumberOptions { decimals?: number; thousandsSep?: string }`
// のように**1 行で書いた型はプロパティが 0 件**と読まれていた。
// その結果、正しく書かれている `@param options.thousandsSep` が
// 「存在しないプロパティ」として P4 に計上されていた(誤検出)。
// 検査が誤って数えると、直す人は「実装が正しいのに文書を壊す」方向へ誘導される。
const TYPE_DECL = /(?:interface|type)\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?(?:=\s*)?\{([\s\S]*?)\n\}/g;
// **1 行で書かれた型は別に拾う。** 上の式に `\n?` を足すと非貪欲が効きすぎて
// 複数行の型を最初の `}` で打ち切ってしまう(P4 が 22→34 件に増えた)。
// 終端の形が違うので、式を分ける方が安全。
const TYPE_DECL_INLINE = /(?:interface|type)\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?(?:=\s*)?\{([^{}\n]+)\}/g;
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
  for (const m of src.matchAll(TYPE_DECL_INLINE)) {
    // **行頭(`^`)を要求しない。** 1 行に `a?: number; b?: string` と並ぶので、
    // 行頭だけを見ると**最初の 1 つしか拾えない**(2026-08 にここで一度つまずいた)。
    // 区切りは行頭か `{` か `;` のいずれか。
    const props = new Set(
      [...m[2].matchAll(/(?:^|[{;])\s*(?:readonly\s+)?([A-Za-z0-9_]+)\s*[?:(]/g)].map((x) => x[1]),
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
  // **交差型(`A & { b?: number }`)は両側を合わせる。**
  // 2026-08 まで片側しか見ておらず、
  // `options: LogStreamOptions & { max?: number }` の `max` を
  // 「存在しないプロパティ」と誤って数えていた。
  // 誤検出は、直す人を「実装が正しいのに文書を壊す」方向へ誘導する。
  const type = decl.slice(decl.indexOf(":") + 1).trim();
  if (type.includes("&")) {
    const merged = new Set();
    let anyKnown = false;
    for (const part of splitIntersection(type)) {
      const props = propsOfType(part, pkg);
      // **1 つでも追えない型が混ざったら判定しない。**
      // 半分だけ見て「無い」と言うと、その型のプロパティが全部誤検出になる
      if (props === null) return null;
      anyKnown = true;
      for (const x of props) merged.add(x);
    }
    return anyKnown ? merged : null;
  }
  return propsOfType(type, pkg);
}

/** `A & B & { … }` を最上位の `&` で割る(ジェネリクスの中は割らない)。 */
function splitIntersection(type) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of type) {
    if ("{<([".includes(ch)) depth += 1;
    else if ("}>)]".includes(ch)) depth -= 1;
    if (ch === "&" && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

/** 単一の型(リテラルか名前)のプロパティ。追えなければ null。 */
function propsOfType(type, pkg) {
  const lit = type.match(/^\{([\s\S]*)\}$/);
  if (lit) return new Set([...lit[1].matchAll(/(?:^|[{;,])\s*(?:readonly\s+)?([A-Za-z0-9_]+)\s*[?:]/g)].map((x) => x[1]));
  const named = type.match(/^([A-Za-z0-9_]+)/);
  if (named === null) return null;
  // **`extends` で外部の型を継ぐものは判定しない。**
  // `interface ConnectOptions extends RequestDeviceOptions {}` のように、
  // 中身が空でも継承元(ここでは Web Bluetooth の標準型)が
  // プロパティを持つことがある。空だからと「無い」と言うと全部誤検出になる。
  if (extendsForeign.has(`${pkg}:${named[1]}`)) return null;
  // **その型が同じパッケージで見つからないなら判定しない。**
  // 他パッケージから import した型は追えないので、黙って通す(誤検出より漏れを選ぶ)
  return typeProps.get(`${pkg}:${named[1]}`) ?? null;
}

/**
 * `extends` を持つ型の一覧。継承元まで追わないので、判定を諦める目印にする。
 * (同じパッケージ内の型を継ぐ場合も、安全側に倒して見送る)
 */
const extendsForeign = new Set();
for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts"] })) {
  if (rel.includes(".test.") || rel.includes("generated")) continue;
  const pkg = rel.split("/")[1];
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  for (const m of src.matchAll(/interface\s+([A-Za-z0-9_]+)(?:<[^>]*>)?\s+extends\s+/g)) {
    extendsForeign.add(`${pkg}:${m[1]}`);
  }
}

const findings = { P1: [], P2: [], P3: [], P4: [] , P5: []};
let checked = 0;

for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts"] })) {
  if (rel.includes(".test.") || rel.includes("generated")) continue;
  const src = readFileSync(path.join(ROOT, rel), "utf8");

  for (const m of src.matchAll(DOC_FN)) {
    const [doc, name] = [m[1], m[2]];
    const raw = paramsAt(src, m.index + m[0].length - 1);
    if (raw === null) continue;

    const documented = [...new Set(
      // **`@param ...parts` の形も読む。** 可変長引数は
      // `@param ...values` と書くのが既存の作法(`fs/path.ts` など)だが、
      // 名前として `...` を認めていなかったため**空文字になり**、
      // 実装(`...values`)と一致しないまま数えられていた(2026-08)。
      // **正しく書いても直らない**状態は、検査を信じなくさせる。
      [...doc.matchAll(/@param\s+(\.{3})?([A-Za-z0-9_.[\]]+)/g)]
        // 入れ子(`props.rows`)は先頭だけを見る。`...` は前に付け直す
        .map((d) => `${d[1] ?? ""}${d[2].split(".")[0]}`),
    )];
    if (documented.length === 0) continue;

    let destructured = false;
    const actual = [];
    const decls = new Map();
    for (const part of splitTop(raw)) {
      // **共通処理を使う**(URL の `//` を巻き込まない)
      const t = stripComments(part).trim();
      if (!t) continue;
      if (t.startsWith("{")) { destructured = true; break; }
      const n = t.split(/[:=?]/)[0].trim();
      // `_` 始まりは「意図的に使わない引数」。説明が残っていても責めない
      if (!n.startsWith("_")) { actual.push(n); decls.set(n, t); }
    }
    if (destructured) continue;

    // **同じ引数を 2 回説明していないか。**
    //
    // 説明を書き足すとき、**既にあることに気づかず追記する**と起きます
    // ——`image.ts` では「@param image 元の画像」が 5 関数で 2 回ずつ、
    // しかも**片方は実装に無い名前**でした(2026-08)。
    //
    // 害は 2 つ: **どちらが正しいか分からない**ことと、
    // **片方だけ直されて食い違いが残る**ことです。
    {
      const seen = new Map();
      for (const d of doc.matchAll(/@param\s+([A-Za-z0-9_.]+)/g)) {
        seen.set(d[1], (seen.get(d[1]) ?? 0) + 1);
      }
      const dup = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
      if (dup.length > 0) {
        findings.P5.push({ rel, name, actual: dup, documented: ["同じ引数を 2 回以上説明しています"] });
      }
    }

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

if (findings.P5.length > limits.p5) {
  failed = true;
  console.error(`\n❌ [P5] 同じ引数を 2 回説明している箇所が ${findings.P5.length} 件に増えました(上限 ${limits.p5})`);
  console.error("   **どちらが正しいか分かりません**。片方だけ直されて食い違いが残ります。");
  for (const e of findings.P5.slice(0, 20)) console.error(`   ${e.rel}: ${e.name}()  ${e.actual.join(", ")}`);
} else if (findings.P5.length > 0) {
  console.log(`⚠ [P5] 同じ引数を 2 回説明している箇所が ${findings.P5.length} 件(上限 ${limits.p5}・詳細は --list)`);
  if (process.argv.includes("--list")) {
    for (const e of findings.P5) console.log(`   ${e.rel}: ${e.name}()  ${e.actual.join(", ")}`);
  }
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
  // **2 種類を分けて出す。** 重さがまるで違う(2026-08):
  //
  // - **説明が抜けている** … 引数があるのに `@param` が無い。
  //   **使い方が分からない**ので、注入が必須の引数(`hashFn` など)だと実際に困る
  // - **名前だけの違い** … `opts` と `options` のような揺れ。実害は小さい
  //
  // 一緒に数えていると「246 件もある」で終わり、**どちらを直せばよいか分からない**
  const missing = findings.P3.filter((e) => e.actual.length > e.documented.length);
  const renamed = findings.P3.filter((e) => e.actual.length <= e.documented.length);
  console.log(`⚠ [P3] ${findings.P3.length} 件(上限 ${limits.p3}・詳細は --list)`);
  console.log(`   ├ 説明が抜けている: ${missing.length} 件 ← **こちらを先に直す**(使い方が分からない)`);
  console.log(`   └ 名前だけの違い  : ${renamed.length} 件(\`opts\` と \`options\` のような揺れ)`);
  if (process.argv.includes("--list")) {
    if (missing.length > 0) {
      console.log("\n   ── 説明が抜けている");
      for (const e of missing) console.log(show(e));
    }
    if (renamed.length > 0) {
      console.log("\n   ── 名前だけの違い");
      for (const e of renamed) console.log(show(e));
    }
  }
}

if (failed) {
  console.error("\nTSDoc はリファレンスサイトにも AI の提案にも使われます。");
  console.error("**間違った説明は、無い場合より確実に誤らせます。**");
  process.exit(1);
}
console.log("✅ 並び順の食い違い(P1)と重複(P5)はありません。P2 / P3 / P4 は上限内です");
