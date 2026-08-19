/**
 * **資料同士の参照関係を図にする。**
 *
 * 【なぜ要るか】
 * 76 件の資料がどう繋がっているかは、**開いてリンクを辿らないと分かりません**。
 * 次のことが一目で分かるようにします:
 *
 * - **入口はどれか**（どこからも参照されず、他を多く参照するもの）
 * - **終点はどれか**（多く参照され、他を参照しないもの）
 * - **孤立していないか**（`check-docs-orphans` が別途見ていますが、図でも分かります）
 * - **相互参照**（お互いを指し合っている＝役割が曖昧な可能性）
 *
 * 【何を「参照」と数えるか】
 * **Markdown のリンク**（`[text](path.md)`）と、
 * **バッククォート内のパス**（`` `docs/ops/CHECKS.md` ``）の両方です。
 * 後者を数えるのは、**この基盤では「詳しくは `docs/ops/X.md` へ」という
 * 書き方が多い**ためです——リンクにしていなくても参照は参照です。
 *
 * 使い方:
 * ```
 * node tools/gen-docs-graph.mjs        → docs/DOCS_GRAPH.md
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "DOCS_GRAPH.md");

/** 対象の資料を集める（生成物は除く）。 */
function collectDocs() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", ".next"].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!e.name.endsWith(".md")) continue;
      const rel = path.relative(ROOT, p).replace(/\\/g, "/");
      // **生成物は除く**（毎回変わるので図が安定しない）
      if (/docs\/(ai|apps|site)\/|erd\/|appmap\/|DOCS_GRAPH/.test(rel)) continue;
      out.push(rel);
    }
  };
  walk(path.join(ROOT, "docs"));
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith(".md")) out.push(f);
  }
  return out.sort();
}

/** ある資料が参照している先を集める。 */
function referencesOf(rel, all) {
  const body = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const dir = path.dirname(rel);
  const found = new Set();
  const add = (target) => {
    // 相対パスを解決する
    const resolved = target.startsWith("docs/") || !target.includes("/")
      ? target
      : path.posix.normalize(path.posix.join(dir, target));
    for (const cand of all) {
      if (cand === resolved || cand.endsWith(`/${target}`) || cand === target) {
        if (cand !== rel) found.add(cand);
      }
    }
  };
  // [text](path.md)
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)]+\.md)\)/g)) add(m[1]);
  // `path.md`
  for (const m of body.matchAll(/`([\w./-]+\.md)`/g)) add(m[1]);
  return [...found];
}

const all = collectDocs();
const edges = new Map();
for (const d of all) edges.set(d, referencesOf(d, all));

const inbound = new Map(all.map((d) => [d, 0]));
for (const [, targets] of edges) {
  for (const t of targets) inbound.set(t, (inbound.get(t) ?? 0) + 1);
}

/** 表示用の短い名前。 */
const short = (p) => p.replace(/^docs\//, "").replace(/\.md$/, "");

// **相互参照**（お互いを指し合っている）
const mutual = [];
for (const [from, targets] of edges) {
  for (const t of targets) {
    // **同じ組を 2 回入れない。** パスの解決で同じ相手が複数回見つかることがある
    if (from < t && (edges.get(t) ?? []).includes(from)
      && !mutual.some(([a, b]) => a === from && b === t)) {
      mutual.push([from, t]);
    }
  }
}

const entries = all
  .map((d) => ({ file: d, out: (edges.get(d) ?? []).length, in: inbound.get(d) ?? 0 }))
  .sort((a, b) => b.in - a.in || b.out - a.out);

let md = `# 資料の参照関係

> **この資料は自動生成です。手で編集しないでください。**
> 作り直す: \`node tools/gen-docs-graph.mjs\`

**${all.length} 件**の資料が、どう参照し合っているかを示します
（生成物は除いています）。

## 読み方

- **参照される数が多い** = **終点**。多くの資料が「詳しくはここへ」と指している
- **参照する数が多い** = **入口**。他を案内する役割
- **どちらも 0** = **孤立**。\`check-docs-orphans\` が別途見張っています

## よく参照される資料（上位 10）

| 資料 | 参照される | 参照する |
|---|---|---|
${entries.slice(0, 10).map((e) => `| \`${short(e.file)}\` | ${e.in} | ${e.out} |`).join("\n")}

## 図

\`\`\`mermaid
graph LR
${(() => {
  // **上位のものだけ描く。** 全部描くと線が絡んで読めない
  const top = new Set(entries.slice(0, 14).map((e) => e.file));
  const lines = [];
  for (const [from, targets] of edges) {
    if (!top.has(from)) continue;
    for (const t of targets) {
      if (!top.has(t)) continue;
      lines.push(`  ${short(from).replace(/[/-]/g, "_")}["${short(from)}"] --> ${short(t).replace(/[/-]/g, "_")}["${short(t)}"]`);
    }
  }
  return [...new Set(lines)].join("\n");
})()}
\`\`\`

## 相互に参照し合っている組

${mutual.length === 0
  ? "**ありません。**"
  : `**${mutual.length} 組**あります。お互いを指し合うのは、
**役割が曖昧**か、**片方に寄せられる**可能性を示します
（ただし「概要 ↔ 詳細」のように意図的な場合もあります）。

| | |
|---|---|
${[...new Set(mutual.map(([a, b]) => `| \`${short(a)}\` | \`${short(b)}\` |`))].join("\n")}`}

## 全件

| 資料 | 参照される | 参照する |
|---|---|---|
${entries.map((e) => `| \`${short(e.file)}\` | ${e.in} | ${e.out} |`).join("\n")}
`;

fs.writeFileSync(OUT, md);
console.log(`✅ docs/DOCS_GRAPH.md を作りました（${all.length} 件・相互参照 ${mutual.length} 組）`);
