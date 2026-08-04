/**
 * **資料に書いてあるコマンドが実際に動くか**を検査する。
 *   node tools/check-doc-commands.mjs
 *
 * 【なぜ必要か】
 * 資料の `pnpm dev:showcase` のようなコマンドは、**書いた時点では正しくても
 * あとで名前が変わる**。読む側は「書いてあるのに動かない」に出くわし、
 * そこで資料全体を信用しなくなる。
 *
 * 2026-08 に実際に見つかった例:
 *   - `pnpm dev:showcase` … 正しくは `pnpm dev:demos`（HANDOVER に残っていた）
 *   - `pnpm dev:balance` … 資料にあるのに package.json に無かった
 *
 * コード内の import は `check-imports` が、資料のリンクは `check-docs-links` が
 * 見ている。**コマンドだけ誰も見ていなかった**ので、ここで埋める。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * pnpm 自身のサブコマンド。package.json のスクリプトではないので対象外。
 * （`pnpm install` などを「存在しないスクリプト」と誤検知しないため）
 */
const PNPM_BUILTINS = new Set([
  "install", "add", "remove", "update", "exec", "dlx", "run", "start",
  "store", "why", "ls", "list", "outdated", "audit", "link", "unlink",
  "publish", "pack", "init", "config", "env", "setup", "prune", "import",
  "rebuild", "root", "bin", "licenses", "patch", "deploy", "fetch",
]);

/** 走査する資料。 */
function collectDocs() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  };
  walk(path.join(ROOT, "docs"));
  for (const f of ["README.md", "CLAUDE.md"]) {
    const p = path.join(ROOT, f);
    try { statSync(p); out.push(p); } catch { /* 無ければ飛ばす */ }
  }
  return out;
}

const scripts = new Set(Object.keys(JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {}));

const problems = [];
for (const file of collectDocs()) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    // バッククォートで囲まれた `pnpm xxx` を拾う。
    // **`--filter` 付きは対象外**（スクリプト名ではなくパッケージ指定のため）
    for (const m of line.matchAll(/`pnpm ([a-z][a-z0-9:._-]*)`/g)) {
      const name = m[1];
      if (PNPM_BUILTINS.has(name)) continue;
      if (scripts.has(name)) continue;
      problems.push({ rel, line: i + 1, name });
    }
  });
}

if (problems.length === 0) {
  console.log(`✅ 資料に書かれた pnpm コマンドはすべて package.json にあります(${collectDocs().length} ファイル検査)`);
  process.exit(0);
}

console.error("❌ 資料に書いてあるのに実行できないコマンドがあります:");
for (const p of problems) {
  console.error(`   ${p.rel}:${p.line}  pnpm ${p.name}`);
}
console.error("\n   資料の書き換え、または package.json への追加が要ります。");
console.error("   **書いてあるのに動かない**と、資料全体が信用されなくなります。");
process.exitCode = 1;
