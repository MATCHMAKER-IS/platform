#!/usr/bin/env node
/**
 * 統合デモサイトの依存が揃っているかを検査する。
 *
 * **`transpilePackages` の漏れはビルドしないと気づけない**(型チェックも smoke も通る)。
 * 実際、task/contract/faq/blog を追加したときに漏れていた。
 *
 * 検査するのは 2 つ:
 * 1. package.json の `@platform/*` 依存 = next.config.mjs の `transpilePackages`
 * 2. ソースが import している `@platform/*` が package.json にある
 */
import { readFileSync, existsSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = path.join(ROOT, "demos/showcase");

/** ディレクトリを再帰して .ts / .tsx を集める。 */
function collectSources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...collectSources(p));
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** 検査する。 */
export function check() {
  const issues = [];
  const pkg = JSON.parse(readFileSync(path.join(SITE, "package.json"), "utf8"));
  const deps = new Set(Object.keys(pkg.dependencies ?? {}).filter((k) => k.startsWith("@platform/")));

  // 1. transpilePackages との一致
  const cfgPath = path.join(SITE, "next.config.mjs");
  if (!existsSync(cfgPath)) {
    issues.push("next.config.mjs がありません");
  } else {
    const cfg = readFileSync(cfgPath, "utf8");
    const listed = new Set([...cfg.matchAll(/"(@platform\/[^"]+)"/g)].map((m) => m[1]));
    for (const d of deps) {
      if (!listed.has(d)) issues.push(`transpilePackages に ${d} がありません(ビルドで失敗します)`);
    }
    for (const l of listed) {
      if (!deps.has(l)) issues.push(`transpilePackages の ${l} は package.json にありません`);
    }
  }

  // 2. ソースの import が package.json にあるか
  const sources = collectSources(path.join(SITE, "src"));
  const imported = new Set();
  for (const f of sources) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/from\s+"(@platform\/[^"/]+)/g)) imported.add(m[1]);
  }
  for (const i of imported) {
    if (!deps.has(i)) issues.push(`${i} を import していますが package.json にありません`);
  }

  return { issues, deps: deps.size, sources: sources.length };
}

const { issues, deps, sources } = check();
if (issues.length > 0) {
  for (const i of issues) console.error(`❌ ${i}`);
  console.error(`\n${issues.length} 件。デモサイトのビルドが失敗します。`);
  process.exit(1);
}
console.log(`✅ 統合デモサイトの依存は整合(${deps} パッケージ / ${sources} ファイル)`);
