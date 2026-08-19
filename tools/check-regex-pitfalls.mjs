#!/usr/bin/env node
/**
 * **検査・生成ツールに、範囲を取り違える正規表現が残っていないか。**
 *
 * 【なぜ要るか】
 * 2026-08 の作業だけで、同じ形の誤りを **9 回**繰り返した。
 * 対策として `tools/lib/source-text.mjs` に共通関数を用意したが、
 * **新しく書くときに思い出せるかは別問題**で、用意した直後にまた踏んだ。
 *
 * 誤った検査は「緑」を返すので、**隠れた問題があること自体に気づけない**。
 * 実際に 3 件が本物の欠陥を隠していた:
 *  - `check-tsdoc` … 完備率が実態より高く出ていた(不足 2 件を隠す)
 *  - `gen-reference` … **API リファレンスの説明 1,208 件が別の宣言のもの**
 *  - `check-build-ready` … 戻り値の型の export 漏れを 1 件見逃していた
 *
 * 【何を見るか】
 * - `[^)]*` で引数を取る … `f(a = new Date())` の `)` で切れる → `argsAt`
 * - `/\\*\\*[\\s\\S]*?\\*\\//` で TSDoc を掴む … 間に別ブロックがあると前を掴む → `docBefore`
 * - 素朴なコメント除去 … URL の `//` を巻き込む → `stripComments`
 *
 * **コメントは除いてから探す。** 注意書きにこれらの形が出てくるため
 * (最初の測定でコメント込み 19 件と出て、実際は 10 件だった)。
 *
 * 【誤検出を避ける】
 * `[^)]*` は Markdown リンク(`](...)`)など**別の用途**でも使う。
 * 「関数の引数を取っている」形に絞る——直前に `function` か識別子 + `\\(` があるもの。
 *
 * 実行: node tools/check-regex-pitfalls.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/source-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = path.join(ROOT, "tools");

/**
 * 探す形と、代わりに使うもの。
 *
 * **`why` は「何が起きるか」を書く。** 「使うな」だけでは直せない。
 */
const PITFALLS = [
  {
    // **関数の引数を取る形に絞る。** `](...)` のような Markdown リンクは対象外。
    //
    // **正規表現で書かない。** エスケープが多段になって読めなくなり、
    // 2026-08 に**過剰にエスケープして一致しない状態**になっていた
    // (自分自身の発火確認で気づいた)。探すのは固定の文字列なので `includes` で足りる。
    // **`([^)]*` を探す**(開き括弧の直後に `[^)]*`)。
    // `\(` を含めると、正規表現リテラル内でのエスケープの有無で取り逃がす
    find: (code) => code.includes("([^)]*"),
    why: "`f(a = new Date())` の `)` で切れ、引数や戻り値を取り違えます",
    use: "argsAt(text, openIndex)",
  },
  {
    find: (code) => code.includes("/\\*\\*[\\s\\S]*?\\*\\/"),
    why: "間に別の TSDoc(`@typedef` など)があると**前のブロックを掴みます**",
    use: "docBefore(src, declIndex)",
  },
  {
    find: (code) => code.includes("replace(/\\/\\/[^\\n]*/g"),
    why: "URL の `//` を巻き込み、**その行の後半が消えます**",
    use: "stripComments(src)",
  },
];

/** 自分自身と共通関数は対象外(この形を文字列として持つのが仕事)。 */
const ALLOW = [
  { re: /^check-regex-pitfalls\.mjs$/, why: "この検査自身。探す形を正規表現として持つ" },
  // **`verify-checks` は違反の見本を content として持つのが仕事。**
  // 「違反を置くと赤くなるか」を確かめるので、危険な書き方を文字列で保持する
  { re: /^verify-checks\.mjs$/, why: "違反の見本を content として持つ。それが仕事" },
  { re: /^lib$/, why: "共通関数の実装" },
  // **入れ子が無いと分かっている形は対象外。**
  // `check-doc-examples` の `new Date\([^)]*\)` は「引数なしの `new Date()` を
  // 消す」用途で、中に括弧は来ない。ここまで弾くと使える形が無くなる。
  { re: /^check-doc-examples\.mjs$/, why: "`new Date()` を消す用途。入れ子が来ない" },
  { re: /^gen-portal-reference\.mjs$/, why: "Markdown リンク `](...)` の除去。関数の引数ではない" },
  { re: /^smoke\.mjs$/, why: "`readFileSync(...)` `catch (...)` の検出。入れ子が来ない形" },
  { re: /^gen-erd\.mjs$/, why: "Prisma の `@relation(...)` の中身。入れ子の括弧が来ない(実データで確認)" },
];

const issues = [];
let checked = 0;

for (const file of readdirSync(TOOLS)) {
  if (!/\.(mjs|mts)$/.test(file)) continue;
  if (ALLOW.some((a) => a.re.test(file))) continue;
  checked += 1;
  const code = stripComments(readFileSync(path.join(TOOLS, file), "utf8"));
  for (const p of PITFALLS) {
    if (!p.find(code)) continue;
    issues.push(`tools/${file}: ${p.why}\n      → ${p.use} を使ってください(tools/lib/source-text.mjs)`);
  }
}

if (issues.length === 0) {
  console.log(`✅ 範囲を取り違える正規表現はありません(${checked} ファイルを検査)`);
  process.exit(0);
}
for (const i of issues) console.error(`❌ ${i}`);
console.error(`\n${issues.length} 件。**誤った検査は「緑」を返すので、隠れた問題に気づけません。**`);
console.error("2026-08 に 3 件が本物の欠陥を隠していました(API リファレンスの説明 1,208 件など)。");
process.exit(1);
