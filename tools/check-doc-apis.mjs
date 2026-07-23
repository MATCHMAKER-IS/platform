/**
 * 資料のコード例が、**実在する公開 API** を使っているか検査する。
 *
 * 資料のコード例は、人も AI もそのまま真似する。
 * 基盤側で関数を移動・改名しても資料は自動では直らないため、
 * 「書いてあるとおりに書いたら存在しなかった」が静かに発生する。
 *
 * 実際、URL 関連の関数を `@platform/net` から `@platform/url` へ移した際、
 * 移動前の import を載せた資料が残りうる状態だった。
 *
 * 検査するもの:
 *   資料内の `import { A, B } from "@platform/xxx"` について
 *     1. そのパッケージが存在するか
 *     2. A / B が公開 API に含まれるか
 *
 * 判定は `docs/platform/api-surface.json`(生成物)を基準にする。
 * 基準が古いと誤検知するため、`pnpm gen:all` の後に実行する。
 *
 * 実行: node tools/check-doc-apis.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SURFACE = path.join(ROOT, "docs/platform/api-surface.json");

if (!existsSync(SURFACE)) {
  console.log("⚠ docs/platform/api-surface.json がありません(node tools/api-surface.mjs --update で作成)");
  process.exit(0);
}

/** パッケージ名 → 公開されている名前の集合。 */
const surface = new Map(
  Object.entries(JSON.parse(readFileSync(SURFACE, "utf8"))).map(([k, v]) => [k, new Set(v)]),
);

/**
 * 検査から外すもの。
 * - サブパス(`@platform/net/browser` 等)は surface が持たないため対象外
 * - `@platform/*` のような総称表記
 */
const isTarget = (mod) => surface.has(mod);

/**
 * 「`@platform/xxx` の `foo()`」という書き方も拾う。
 *
 * 資料では import 文より、この形の言及の方が多い。
 * 同じ行(または直前の行)にパッケージ名がある関数名だけを対象にして、
 * 一般的な関数名(fetch など)を巻き込まないようにする。
 */
function checkInlineMentions(file, rel, body, issues) {
  const lines = body.split("\n");
  let checked = 0;
  lines.forEach((line, idx) => {
    if (line.includes("doc-apis:ignore")) return;
    // 「`@platform/xxx` の `foo()`」という並びだけを対象にする。
    // 行内に関数名があるだけでは、アプリ側の関数を基盤のものと誤認するため。
    for (const m of line.matchAll(/`?(@platform\/[a-z0-9-]+)`?\s*の\s*`([a-zA-Z][A-Za-z0-9_]{2,})\(\)`/g)) {
      const mod = m[1];
      if (!surface.has(mod)) continue;
      checked += 1;
      if (!surface.get(mod).has(m[2])) {
        issues.push({ rel, line: idx + 1, message: `${mod} に ${m[2]}() はありません(移動・改名された可能性)` });
      }
    }
  });
  return checked;
}

const docs = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (e.name.endsWith(".md")) docs.push(fp);
  }
};
walk(path.join(ROOT, "docs"));
for (const f of ["CLAUDE.md", "README.md", "CONTRIBUTING.md"]) {
  const p = path.join(ROOT, f);
  if (existsSync(p)) docs.push(p);
}

// import { A, B as C, type D } from "@platform/xxx"
const IMPORT = /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*["'](@platform\/[a-z0-9-]+)["']/g;

const issues = [];
let checked = 0;

for (const file of docs) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const body = readFileSync(file, "utf8");
  const lines = body.split("\n");

  checked += checkInlineMentions(file, rel, body, issues);

  for (const m of body.matchAll(IMPORT)) {
    const mod = m[2];
    if (!isTarget(mod)) continue;
    const line = body.slice(0, m.index).split("\n").length;
    if (lines[line - 1]?.includes("doc-apis:ignore")) continue;
    checked += 1;

    const names = m[1]
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
      .filter((s) => s !== "");

    const exported = surface.get(mod);
    for (const n of names) {
      if (!exported.has(n)) {
        issues.push({ rel, line, message: `${mod} に ${n} はありません(移動・改名された可能性)` });
      }
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ 資料のコード例は実在する API を使っています(${checked} 件の import を検査)`);
  process.exit(0);
}

for (const i of issues) console.log(`❌ ${i.rel}:${i.line} ${i.message}`);
console.log(`❌ 実在しない API を使った例が ${issues.length} 件。真似した人のコードが動きません。`);
process.exit(1);
