#!/usr/bin/env node
/**
 * **生タグに、部品専用の props が残っていないか**を見る。
 *
 * 【何が起きたか】
 * `<td variant="secondary">` のように、**HTML の要素に `@platform/ui` の props**が
 * 付いた状態が **26 箇所**あった(2026-08)。`<Button>` から書き換えた名残と思われる。
 *
 * それ自体は「何の効果も無い属性」で、実害は小さい。**問題は副作用の方**:
 *
 * > `check-app-rules` / smoke の「Button の色を className で塗っていないか」は、
 * > **その行に `variant=` があれば見逃す**作りだった。
 * > 生タグに付いた無意味な `variant=` が、**同じ行にある本物の違反を隠していた**。
 *
 * 実際、この 26 箇所を消したところ、**青地に青文字で読めない `<Button>` が
 * 26 箇所**出てきた(既定の variant は `primary` = 青地)。
 *
 * **「意味の無い属性」は、それ自体より、検査を黙らせることの方が高くつく。**
 *
 * 【何を見るか】
 * HTML の要素(`td` / `div` / `span` …)に、**HTML には存在しない**
 * 部品専用の props が付いていないか。
 *
 * **`size` や `placeholder` は見ない**——`<input size>` `<input placeholder>` のように
 * HTML にも実在し、正当に使えるため。**迷ったら入れない**方針にしている。
 *
 * 実行: node tools/check-intrinsic-props.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 走査するディレクトリ。 */
const DIRS = ["apps", "packages"];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "generated"]);

/**
 * HTML の要素。**小文字で始まるものが JSX の「生タグ」**(部品は大文字)。
 * ここに挙げたものだけを見る(未知のタグを弾くと Web Components で誤検出する)。
 */
const INTRINSIC = [
  "div", "span", "p", "a", "li", "ul", "ol", "section", "article", "header", "footer",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "form", "label", "small", "strong",
  "h1", "h2", "h3", "h4", "h5", "h6", "nav", "main", "aside", "figure", "figcaption",
];

/**
 * 部品専用の props。**HTML に同名の属性が無いものだけ**を挙げる。
 *
 * `size`(input/select)・`placeholder`(input/textarea)・`disabled` などは
 * HTML にも実在するので**入れない**。誤検出は検査そのものを殺す。
 */
const COMPONENT_PROPS = [
  "variant",
  "onValueChange",
  "onCheckedChange",
  "isEmpty",
  "emptyTitle",
  "emptyDescription",
  "loadingLabel",
  "submitLabel",
  "onRetry",
  // **`onSelect` は入れない。** React の合成イベントとして
  // **HTML の要素にも実在します**(テキストを選択したとき)。
  // 部品にも同名の props があるが、**生タグに付いていても誤りとは限らない**
  // ——誤検出は検査ごと信用を失わせる(2026-08 に一度入れて外した)。
];

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

const files = DIRS.flatMap((d) => collect(path.join(ROOT, d)));
const offenders = [];

// `<td … variant=…>` のように、生タグの開きタグの中に部品の props があるもの
const tagRe = new RegExp(`<(${INTRINSIC.join("|")})(\\s[^>]*?)?/?>`, "g");
const propRe = new RegExp(`\\s(${COMPONENT_PROPS.join("|")})\\s*=`);

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const body = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const m of body.matchAll(tagRe)) {
    const attrs = m[2] ?? "";
    const hit = attrs.match(propRe);
    if (hit === null) continue;
    const lineNo = body.slice(0, m.index).split("\n").length;
    offenders.push({ where: `${rel}:${lineNo}`, tag: m[1], prop: hit[1] });
  }
}

if (offenders.length === 0) {
  console.log(`✅ 生タグに部品の props は残っていません(${files.length} ファイルを検査)`);
  process.exit(0);
}

console.error(`❌ 生タグに部品の props が残っています(${offenders.length} 件 / ${files.length} ファイルを検査):`);
for (const o of offenders) {
  console.error(`   ${o.where}: <${o.tag} ${o.prop}=…> は効きません`);
}
console.error("");
console.error("   **消すだけでは終わらないことがあります。** 2026-08、この形の 26 箇所が");
console.error("   「同じ行に variant= があれば見逃す」判定を通しており、");
console.error("   **青地に青文字で読めない <Button> を 26 箇所隠して**いました。");
console.error("   消したあとに `pnpm smoke` を回して、隠れていた違反が出ないか確かめてください。");
process.exit(1);
