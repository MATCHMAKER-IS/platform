/**
 * **`tools/smoke.mjs` のセクション索引**を作る。
 *
 * 【なぜ要るか】
 * `smoke.mjs` は **2 万行を超える 1 ファイル**(正確な数は
 * `docs/ai/smoke-index.md` の冒頭。**このツールが毎回書き出す**)。
 *
 * **ここに数値を固定で書かないこと。** 2026-08 まで
 * 「20,620 行・465 セクション」と書いてありましたが、実際は
 * **24,549 行・399 セクション**でした——**説明文の数値は誰も直さない**ので、
 * 生成される索引を見る形にしてあります。
 * 「請求書の検査はどこか」を探すのに、毎回 `grep` することになる。
 *
 * 【なぜ分割しないか】
 * **依存をインストールせずに実ソースを動かす**のが `smoke.mjs` の役目で、
 * そのために**各セクションが自分でスタブを組み立てて**いる
 * (`@platform/core` の最小実装をその場で書き出す、など)。
 * 分割すると、**スタブの重複か、共有のための新しい仕組み**が要る。
 *
 * さらに、**セクション間で変数を共有している**箇所がある。
 * 分割の作業そのものが 2,000 件超の検査を壊すリスクを持つので、
 * **索引で探しやすくする方を選んだ**(2026-08)。
 *
 * 【いつ分割を考えるか】
 * - スタブの重複が**目に見えて増えた**とき
 * - 1 セクションを直すのに**周りを読まないと分からない**状態になったとき
 *
 * どちらも「今はそうなっていない」ので、**索引で足りる**。
 *
 * 使い方:
 * ```
 * node tools/gen-smoke-index.mjs         # docs/ai/smoke-index.md を作り直す
 * node tools/gen-smoke-index.mjs --check # 最新かどうかだけ見る(CI 用)
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "tools", "smoke.mjs");
const OUT = path.join(ROOT, "docs", "ai", "smoke-index.md");

/** セクションと行番号を集める。 */
function collectSections() {
  const lines = fs.readFileSync(SRC, "utf8").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    // **`section("…")` の呼び出し**。インデントの有無は問わない
    const m = /^\s*section\(\s*["'`](.+?)["'`]/.exec(line);
    if (m) out.push({ line: i + 1, title: m[1] });
  }
  return out;
}

/** 各セクションの検査数を数える(次のセクションまでの `ok(` の数)。 */
function countChecks(sections) {
  const lines = fs.readFileSync(SRC, "utf8").split("\n");
  return sections.map((s, idx) => {
    const end = idx + 1 < sections.length ? (sections[idx + 1]?.line ?? lines.length) : lines.length;
    let n = 0;
    for (let i = s.line; i < end; i += 1) {
      if (/\bok\(/.test(lines[i] ?? "")) n += 1;
    }
    return { ...s, checks: n };
  });
}

const sections = countChecks(collectSections());
const total = sections.reduce((a, s) => a + s.checks, 0);

const body = [
  "# smoke のセクション索引（自動生成）",
  "",
  "`node tools/gen-smoke-index.mjs` で作り直します。**手で編集しないこと。**",
  "",
  `\`tools/smoke.mjs\` は **${fs.readFileSync(SRC, "utf8").split("\n").length.toLocaleString()} 行・${sections.length} セクション・約 ${total.toLocaleString()} 件**の検査です。`,
  "目的の箇所を探すのに使ってください。",
  "",
  "## なぜ 1 ファイルなのか",
  "",
  "**依存をインストールせずに実ソースを動かす**のが役目で、そのために",
  "各セクションが自分でスタブを組み立てています（`@platform/core` の最小実装を",
  "その場で書き出す、など）。分割すると **スタブの重複か、共有のための新しい仕組み**が要ります。",
  "",
  "分割を考えるのは、**スタブの重複が目に見えて増えた**とき、または",
  "**1 セクションを直すのに周りを読まないと分からない**状態になったときです。",
  "",
  "## 一覧",
  "",
  "| 行 | セクション | 検査数 |",
  "|---|---|---|",
  ...sections.map((s) => `| ${s.line} | ${s.title.replace(/\|/g, "\\|")} | ${s.checks} |`),
  "",
].join("\n");

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== body) {
    console.error("❌ smoke の索引が古くなっています。`node tools/gen-smoke-index.mjs` を実行してください");
    process.exit(1);
  }
  console.log(`✅ smoke の索引は最新です(${sections.length} セクション)`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body);
console.log(`✅ smoke の索引を作りました(${sections.length} セクション / 約 ${total.toLocaleString()} 件)`);
