/**
 * Platform Advisor — 基盤の「見つけやすさ」と「重複」を分析する(壁打ちの Package Finder / Duplicate Detector)。
 *
 *   node tools/advisor.mjs find <キーワード...>   # パッケージ/export を横断検索(新規実装の前に既存を探す)
 *   node tools/advisor.mjs dup                     # 似た export 名・似たパッケージ概要を検出
 *   node tools/advisor.mjs report                  # docs/ai/advisor-report.md を生成(重複候補+孤立パッケージ)
 *   node tools/advisor.mjs json                    # 機械可読(Portal /api/advisor 用)
 *
 * 情報源: docs/platform/api-surface.json(export)/ packages READMEの冒頭要約 / module-list(カテゴリ)。
 * 目的は「AI や人が新規作成の前に既存を再利用できる」こと。判定は決定的で、ネットワーク不要。
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { docBefore, summaryOf, stripComments } from "./lib/source-text.mjs";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// **改行コードを LF に揃えてから使う。**
// Windows の checkout(core.autocrlf)で CRLF になると、
// 行単位の解析が軒並み外れる。.gitattributes で防いでいるが、
// ZIP 展開や手作業のコピーではそれが効かないので、読む側でも吸収する。
const read = (rel) => (existsSync(path.join(ROOT, rel))
  ? readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n")
  : "");

function loadPackages() {
  const surface = JSON.parse(read("docs/platform/api-surface.json") || "{}");
  const md = read("docs/ai/module-list.md");
  const catMap = {};
  let cur = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { cur = h[1].trim(); continue; }
    const p = line.match(/\*\*@platform\/([a-z-]+)\*\*/);
    if (p) catMap[p[1]] = cur;
  }
  const pkgDir = path.join(ROOT, "packages");
  const names = readdirSync(pkgDir).filter((d) => existsSync(path.join(pkgDir, d, "package.json"))).sort();
  return names.map((name) => {
    const readme = read(`packages/${name}/README.md`);
    const summary = readme.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"))?.replace(/[*`]/g, "") ?? "";
    return { name, category: catMap[name] ?? "その他", summary, exports: surface[`@platform/${name}`] ?? [] };
  });
}

// ── find ──
/**
 * 関数・型を名前と説明から探す。
 *
 * **パッケージ単位では粗すぎる。** 「二重送信」のような**やりたいこと**で
 * 探したいのに、パッケージの説明文には出てこない
 * ——2026-08 に、既に `useSubmitFlow` があるのに `useSubmit` を作った。
 *
 * @param {string[]} keywords 探す語(**日本語でもよい**)
 * @returns {{pkg: string, name: string, summary: string}[]} 見つかったもの
 */
function findExports(keywords) {
  const qs = keywords.map((k) => k.toLowerCase());
  const out = [];
  for (const rel of collectFiles(["packages"], ROOT, { extensions: [".ts", ".tsx"] })) {
    if (/\.test\.tsx?$/.test(rel)) continue;
    const src = readFileSync(path.join(ROOT, rel), "utf8");
    const pkg = rel.replace(/\\/g, "/").split("/")[1] ?? "";
    for (const m of stripComments(src).matchAll(/^export (?:async )?(?:function|const|interface|type|class) (\w+)/gm)) {
      const name = m[1] ?? "";
      const summary = summaryOf(docBefore(src, m.index ?? 0));
      const hay = `${name} ${summary}`.toLowerCase();
      if (qs.some((q) => hay.includes(q))) out.push({ pkg, name, summary });
    }
  }
  return out;
}

function find(keywords) {
  const pkgs = loadPackages();
  const terms = keywords.map((k) => k.toLowerCase());
  const scored = pkgs.map((p) => {
    let score = 0;
    const matchedExports = [];
    for (const t of terms) {
      if (p.name.includes(t)) score += 5;
      if (p.summary.toLowerCase().includes(t)) score += 2;
      for (const e of p.exports) if (e.toLowerCase().includes(t)) { score += 3; matchedExports.push(e); }
    }
    return { ...p, score, matchedExports: [...new Set(matchedExports)] };
  }).filter((p) => p.score > 0).sort((a, b) => b.score - a.score);
  return scored;
}

// ── 重複検出 ──
// 正規化: export 名から動詞接頭辞と型接尾辞を落として「概念」を取り出す
function conceptOf(name) {
  return name
    .replace(/^(create|make|build|get|set|is|has|use|to|from|parse|format|with)/i, "")
    .replace(/(Store|Adapter|Options|Result|Config|Client|Provider|Def|Info|Input|Output|Handler|Service)$/i, "")
    .toLowerCase();
}

function duplicates() {
  const pkgs = loadPackages();
  // 1) 同名 export(異なるパッケージに同じ export 名)
  const exportOwners = new Map();
  for (const p of pkgs) for (const e of p.exports) {
    if (!exportOwners.has(e)) exportOwners.set(e, []);
    exportOwners.get(e).push(p.name);
  }
  const sameName = [...exportOwners.entries()].filter(([, owners]) => owners.length > 1).map(([e, owners]) => ({ export: e, packages: owners }));

  // 2) 近い概念(接頭辞・接尾辞を除いた語幹が一致、かつ 4 文字以上)
  const conceptOwners = new Map();
  for (const p of pkgs) for (const e of p.exports) {
    const c = conceptOf(e);
    if (c.length < 4) continue;
    if (!conceptOwners.has(c)) conceptOwners.set(c, []);
    conceptOwners.get(c).push({ pkg: p.name, export: e });
  }
  const similar = [...conceptOwners.entries()]
    .filter(([, list]) => new Set(list.map((x) => x.pkg)).size > 1)
    .map(([concept, list]) => ({ concept, items: list }))
    .filter((g) => !sameName.some((s) => conceptOf(s.export) === g.concept)); // 同名は別掲

  // 3) 孤立(export 0 または README 要約なし)
  //
  // **設定を配るだけのパッケージは対象外。** `@platform/config` は
  // `tsconfig.base.json` と vitest のプリセットを配るのが仕事で、
  // **TypeScript の export が無いのが正常**——毎回「孤立」と出ると、
  // **本当の孤立に気づけなくなる**(2026-08)。
  const CONFIG_ONLY = new Set(["config"]);
  const isolated = pkgs
    .filter((p) => !CONFIG_ONLY.has(p.name))
    .filter((p) => p.exports.length === 0 || p.summary === "")
    .map((p) => ({ name: p.name, reason: p.exports.length === 0 ? "public export なし" : "README 要約なし" }));

  return { sameName, similar, isolated };
}

function toReport() {
  const d = duplicates();
  const lines = ["# Advisor レポート(自動生成)", "", `> 再生成: \`node tools/advisor.mjs report\`。生成日: ${new Date().toISOString().slice(0, 10)}`, "", "重複や似た API は「わざと(層が違う)」の場合もあります。這は**再利用の当たりを付ける入口**であり、機械的な指摘です。", ""];
  lines.push(`## 同名 export(${d.sameName.length} 組)`, "");
  if (d.sameName.length === 0) lines.push("なし。", "");
  else { lines.push("| export | 提供パッケージ |", "|---|---|"); for (const s of d.sameName) lines.push(`| \`${s.export}\` | ${s.packages.map((p) => `@platform/${p}`).join(", ")} |`); lines.push(""); }
  lines.push(`## 似た概念の export(${d.similar.length} 組・上位20)`, "");
  if (d.similar.length === 0) lines.push("なし。", "");
  else { lines.push("| 概念 | 該当 |", "|---|---|"); for (const g of d.similar.slice(0, 20)) lines.push(`| ${g.concept} | ${g.items.map((i) => `@platform/${i.pkg}:${i.export}`).join(" / ")} |`); lines.push(""); }
  lines.push(`## 孤立パッケージ(${d.isolated.length})`, "");
  if (d.isolated.length === 0) lines.push("なし。", "");
  else { lines.push("| パッケージ | 指摘 |", "|---|---|"); for (const i of d.isolated) lines.push(`| @platform/${i.name} | ${i.reason} |`); lines.push(""); }
  return lines.join("\n");
}

// ── CLI(直接実行時のみ) ──
import { fileURLToPath } from "node:url";
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "find") {
  if (rest.length === 0) { console.error("キーワードを指定してください: node tools/advisor.mjs find mail 送信"); process.exit(1); }
  const hits = find(rest);
  // **関数の説明まで探す。** パッケージ単位だけだと粒度が粗く、
  // 「二重送信」のような**やりたいこと**では当たらない
  // ——2026-08 に、既に `useSubmitFlow` があるのに `useSubmit` を作った(2026-08 に追加)
  const fnHits = findExports(rest);
  if (hits.length === 0 && fnHits.length === 0) { console.log(`「${rest.join(" ")}」に一致するものは見つかりませんでした(新規作成の候補)。`); }
  else if (hits.length === 0) { console.log(`「${rest.join(" ")}」に一致するパッケージはありませんが、関数が見つかりました:\n`); }
  else { console.log(`「${rest.join(" ")}」の候補(再利用できるかもしれません):\n`); for (const h of hits.slice(0, 10)) console.log(`  @platform/${h.name}(${h.category})  score=${h.score}\n    ${h.summary}${h.matchedExports.length ? `\n    export: ${h.matchedExports.slice(0, 6).join(", ")}` : ""}`); }
  // **関数単位の結果も出す。** パッケージが当たらなくても、
  // 目的の関数だけ既にあることがある
  if (fnHits.length > 0) {
    console.log(`\n  ── 関数・型(${fnHits.length} 件)`);
    for (const f of fnHits.slice(0, 12)) {
      console.log(`  @platform/${f.pkg}  ${f.name}`);
      if (f.summary !== "") console.log(`    ${f.summary.slice(0, 70)}`);
    }
    if (fnHits.length > 12) console.log(`  …他 ${fnHits.length - 12} 件`);
    console.log("\n  **同じものが既にあるなら、作らずにそれを使ってください。**");
  }
} else if (cmd === "dup") {
  const d = duplicates();
  console.log(`同名 export: ${d.sameName.length} 組 / 似た概念: ${d.similar.length} 組 / 孤立: ${d.isolated.length}`);
  for (const s of d.sameName.slice(0, 10)) console.log(`  [同名] ${s.export} ← ${s.packages.join(", ")}`);
  for (const g of d.similar.slice(0, 10)) console.log(`  [類似] ${g.concept}: ${g.items.map((i) => `${i.pkg}:${i.export}`).join(" / ")}`);
} else if (cmd === "report") {
  writeFileSync(path.join(ROOT, "docs/ai/advisor-report.md"), toReport());
  const d = duplicates();
  console.log(`✅ docs/ai/advisor-report.md 生成(同名 ${d.sameName.length} / 類似 ${d.similar.length} / 孤立 ${d.isolated.length})`);
} else if (cmd === "json") {
  console.log(JSON.stringify(duplicates(), null, 2));
} else {
  console.error("使い方: node tools/advisor.mjs <find|dup|report|json>");
  process.exit(1);
}

}

export { find, duplicates, loadPackages };
