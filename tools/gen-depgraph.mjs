/**
 * パッケージ間の依存グラフを Mermaid で生成する(人向けドキュメント)。
 *   node tools/gen-depgraph.mjs   → docs/platform/depgraph.md
 * 各 @platform/* パッケージの dependencies(@platform/* のみ)を辺にする。
 * 100 パッケージの全体図は大きすぎるため、(1) カテゴリ間の依存集約グラフ と
 * (2) 依存が多い/されるパッケージの上位表 を出す。
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./package-categories.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const pkgDir = path.join(ROOT, "packages");

/** name -> { deps: string[], category } を集める。 */
function collect() {
  const catOf = {};
  for (const [cat, pkgs] of Object.entries(CATEGORIES)) for (const p of pkgs) catOf[p] = cat;
  const nodes = {};
  for (const name of readdirSync(pkgDir)) {
    const pkgPath = path.join(pkgDir, name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const deps = [...Object.keys(pkg.dependencies ?? {})]
      .filter((d) => d.startsWith("@platform/"))
      .map((d) => d.replace("@platform/", ""));
    nodes[name] = { deps, category: catOf[name] ?? "その他" };
  }
  return nodes;
}

function build() {
  const nodes = collect();
  const names = Object.keys(nodes);

  // (1) カテゴリ間依存(集約)
  const catEdges = new Map(); // "A->B" -> count
  for (const name of names) {
    const from = nodes[name].category;
    for (const dep of nodes[name].deps) {
      const to = nodes[dep]?.category;
      if (!to || to === from) continue;
      const key = `${from}=>${to}`;
      catEdges.set(key, (catEdges.get(key) ?? 0) + 1);
    }
  }

  // (2) 被依存ランキング(よく使われる基盤)
  const inDeg = {};
  for (const name of names) for (const dep of nodes[name].deps) inDeg[dep] = (inDeg[dep] ?? 0) + 1;
  const topDepended = Object.entries(inDeg).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // (3) 依存元が多いパッケージ(重い集約点)
  const outDeg = names.map((n) => [n, nodes[n].deps.length]).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return { nodes, catEdges, topDepended, outDeg };
}

function toMarkdown({ catEdges, topDepended, outDeg }) {
  const catId = (c) => "C" + c.replace(/[^A-Za-z0-9]/g, "_");
  const lines = ["# パッケージ依存グラフ(自動生成）", "", "> 再生成: `node tools/gen-depgraph.mjs`。手で編集しない。", ""];

  lines.push("## カテゴリ間の依存", "", "各カテゴリのパッケージが、他カテゴリのパッケージを何本 import しているか（数字は本数）。", "", "```mermaid", "flowchart LR");
  const cats = new Set();
  for (const key of catEdges.keys()) { const [f, t] = key.split("=>"); cats.add(f); cats.add(t); }
  for (const c of [...cats].sort()) lines.push(`  ${catId(c)}["${c}"]`);
  for (const [key, count] of [...catEdges.entries()].sort((a, b) => b[1] - a[1])) {
    const [f, t] = key.split("=>");
    lines.push(`  ${catId(f)} -->|${count}| ${catId(t)}`);
  }
  lines.push("```", "");

  lines.push("## よく使われる基盤パッケージ(被依存トップ12)", "", "| パッケージ | 被依存数 |", "|---|---|");
  for (const [name, n] of topDepended) lines.push(`| \`@platform/${name}\` | ${n} |`);
  lines.push("");

  lines.push("## 依存が多いパッケージ(依存元トップ12)", "", "| パッケージ | 依存数 |", "|---|---|");
  for (const [name, n] of outDeg) lines.push(`| \`@platform/${name}\` | ${n} |`);
  lines.push("");

  return lines.join("\n");
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = build();
  writeFileSync(path.join(ROOT, "docs/platform/depgraph.md"), toMarkdown(data));
  const catEdgeCount = data.catEdges.size;
  console.log(`✅ docs/platform/depgraph.md 生成(カテゴリ間 ${catEdgeCount} 辺 / 被依存トップ ${data.topDepended.length})`);
}

export { collect, build, toMarkdown };
