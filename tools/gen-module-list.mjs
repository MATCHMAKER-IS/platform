/**
 * docs/ai/module-list.md を自動生成する。パッケージをカテゴリ別に一覧化し、
 * 各パッケージの1行説明(README冒頭)と主なエクスポート(api-surface)を載せる。
 * AI(Claude Code等)が「使える部品」を素早く把握するためのインデックス。
 * 使い方: node tools/gen-module-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./package-categories.mjs";

const root = new URL("..", import.meta.url).pathname;
const surface = JSON.parse(fs.readFileSync(path.join(root, "docs/platform/api-surface.json"), "utf8"));


function firstLine(pkg) {
  const readme = path.join(root, "packages", pkg, "README.md");
  if (!fs.existsSync(readme)) return "";
  const lines = fs.readFileSync(readme, "utf8").split("\n").map((l) => l.trim());
  return lines.find((l) => l && !l.startsWith("#")) ?? "";
}

const all = new Set(fs.readdirSync(path.join(root, "packages")).filter((d) => fs.statSync(path.join(root, "packages", d)).isDirectory()));
const categorized = new Set(Object.values(CATEGORIES).flat());
const uncat = [...all].filter((p) => !categorized.has(p));

let out = `# パッケージ一覧(カテゴリ別)\n\n> 自動生成: \`node tools/gen-module-list.mjs\`(手で編集しない)。\n> 目的: AI・新規参加者が「既にある部品」を再実装せず使うためのインデックス。詳細は各 \`packages/<name>/README.md\` を参照。\n\n`;
let count = 0;
for (const [cat, pkgs] of Object.entries(CATEGORIES)) {
  const present = pkgs.filter((p) => all.has(p));
  if (present.length === 0) continue;
  out += `## ${cat}\n\n`;
  for (const p of present) {
    const exports = surface[`@platform/${p}`] ?? [];
    const desc = firstLine(p);
    const top = exports.slice(0, 6).join(", ") + (exports.length > 6 ? `, …(全${exports.length})` : "");
    out += `- **@platform/${p}** — ${desc}\n  - 主なexport: ${top || "(api-surface未計上)"}\n`;
    count += 1;
  }
  out += "\n";
}
if (uncat.length > 0) out += `## 未分類\n\n${uncat.map((p) => `- @platform/${p}`).join("\n")}\n`;
fs.writeFileSync(path.join(root, "docs/ai/module-list.md"), out);
console.log(`✅ docs/ai/module-list.md 生成: ${count} パッケージ / 未分類 ${uncat.length}`);
