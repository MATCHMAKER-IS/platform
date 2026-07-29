/**
 * docs/ai/module-list.md を自動生成する。パッケージをカテゴリ別に一覧化し、
 * 各パッケージの1行説明(README冒頭)と主なエクスポート(api-surface)を載せる。
 * AI(Claude Code等)が「使える部品」を素早く把握するためのインデックス。
 * 使い方: node tools/gen-module-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./package-categories.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const surface = JSON.parse(fs.readFileSync(path.join(root, "docs/platform/api-surface.json"), "utf8"));


function firstLine(pkg) {
  const readme = path.join(root, "packages", pkg, "README.md");
  if (!fs.existsSync(readme)) return "";
  const lines = fs.readFileSync(readme, "utf8").split("\n").map((l) => l.trim());
  return lines.find((l) => l && !l.startsWith("#")) ?? "";
}

const all = new Set(fs.readdirSync(path.join(root, "packages")).filter((d) => fs.statSync(path.join(root, "packages", d)).isDirectory()));

/**
 * **どこからも import されていない**パッケージを見つけるため、利用側を集める。
 *
 * 対象は apps / demos / 他パッケージ(テストを含む)。他の部品から使われていれば、
 * 少なくとも一度は動かされている。
 *
 * 誰にも使われていない部品は「あるはず」と思って選ばれ、**最初の利用者がバグを踏む役**に
 * なる。動くことが一度も確かめられていないので、印を付けて選ぶ前に分かるようにする。
 */
const usedPackages = new Set();
for (const group of ["apps", "demos", "packages"]) {
  const groupDir = path.join(root, group);
  if (!fs.existsSync(groupDir)) continue;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      // 生成物は対象外。リファレンスデータには**全パッケージ名が載る**ため、
      // 含めると「全部使われている」ことになり判定が意味を失う
      if (entry.name.includes(".generated.")) continue;
      // **import 文だけ**を見る。TSDoc の言及まで数えると「関連パッケージを
      // 説明しているだけ」で使用済みになり、判定が甘くなる
      const text = fs.readFileSync(full, "utf8");
      // 自分自身への参照は「使われている」に数えない
      const owner = group === "packages" ? full.slice(groupDir.length + 1).split(path.sep)[0] : null;
      for (const m of text.matchAll(/(?:from|import|require)\s*\(?\s*["'`]@platform\/([a-z0-9-]+)/g)) {
        if (m[1] !== owner) usedPackages.add(m[1]);
      }
    }
  };
  walk(groupDir);
}
const categorized = new Set(Object.values(CATEGORIES).flat());
const uncat = [...all].filter((p) => !categorized.has(p));

let out = "# パッケージ一覧(カテゴリ別)\n\n"
  + "> 自動生成: `node tools/gen-module-list.mjs`(手で編集しない)。\n"
  + "> 目的: AI・新規参加者が「既にある部品」を再実装せず使うためのインデックス。詳細は各 `packages/<name>/README.md` を参照。\n"
  + ">\n"
  + "> **⚠ 未実戦** = アプリ・デモ・他パッケージのどこからも import されていないパッケージ。\n"
  + "> 実装はあるが**動作が一度も確かめられていない**ため、最初に使う人はバグを踏む可能性がある。\n\n";
let count = 0;
for (const [cat, pkgs] of Object.entries(CATEGORIES)) {
  const present = pkgs.filter((p) => all.has(p));
  if (present.length === 0) continue;
  out += `## ${cat}\n\n`;
  for (const p of present) {
    const exports = surface[`@platform/${p}`] ?? [];
    const desc = firstLine(p);
    const top = exports.slice(0, 6).join(", ") + (exports.length > 6 ? `, …(全${exports.length})` : "");
    const mark = usedPackages.has(p) ? "" : " **⚠ 未実戦**";
    out += `- **@platform/${p}**${mark} — ${desc}\n  - 主なexport: ${top || "(api-surface未計上)"}\n`;
    count += 1;
  }
  out += "\n";
}
if (uncat.length > 0) out += `## 未分類\n\n${uncat.map((p) => `- @platform/${p}`).join("\n")}\n`;
fs.writeFileSync(path.join(root, "docs/ai/module-list.md"), out);
const unused = [...all].filter((p) => !usedPackages.has(p)).sort();
console.log(`✅ docs/ai/module-list.md 生成: ${count} パッケージ / 未分類 ${uncat.length} / 未実戦 ${unused.length}`);
if (unused.length > 0) console.log(`   未実戦: ${unused.join(", ")}`);
