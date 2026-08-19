#!/usr/bin/env node
/**
 * 内部パッケージ依存グラフの検査(オフラインで実行可)。
 *  1. 循環依存(A→B→A)を検出
 *  2. 層破り(package が app/demo に依存)を検出
 * package.json の dependencies/devDependencies のうち @platform/* を対象にする。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
// **demos は無くなった。** showcase は apps に移した(実運用扱い)
const GROUPS = { package: "packages", app: "apps" };

/** 全ワークスペースの {name, layer, deps[]} を集める。 */
function collect() {
  const nodes = new Map(); // name -> { layer, deps:Set }
  const nameToLayer = new Map();
  for (const [layer, dir] of Object.entries(GROUPS)) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(base, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      // **`@platform/testing` への devDependency は循環に数えない。**
      //
      // `testing` は**テストの中だけで動く**もので、
      // 契約テスト(「どの実装でも同じ約束を守るか」)を提供するために
      // **検査対象の型を参照します**(`Cache` / `Storage`)。
      // したがって `cache → testing → cache` は**必ず起きる**——
      // これを循環として弾くと、**契約テストという仕組みそのものが使えません**。
      //
      // **実行時には成立しない**(テストはビルド成果物に入らない)ので、
      // 「本番で読み込みが詰まる」類の問題は起きません。
      // **`dependencies` に入っていたら従来どおり循環として扱います。**
      const testOnly = new Set(["@platform/testing"]);
      const deps = new Set(
        [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}).filter((d) => !testOnly.has(d)),
        ].filter((d) => d.startsWith("@platform/")),
      );
      nodes.set(pkg.name, { layer, deps });
      nameToLayer.set(pkg.name, layer);
    }
  }
  return { nodes, nameToLayer };
}

/** DFS で全循環を検出。 */
function findCycles(nodes) {
  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];
  for (const n of nodes.keys()) color.set(n, WHITE);
  function visit(n) {
    color.set(n, GRAY);
    stack.push(n);
    for (const dep of nodes.get(n)?.deps ?? []) {
      if (!nodes.has(dep)) continue; // 外部 or 未定義は無視
      if (color.get(dep) === GRAY) {
        const i = stack.indexOf(dep);
        cycles.push([...stack.slice(i), dep]);
      } else if (color.get(dep) === WHITE) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  }
  for (const n of nodes.keys()) if (color.get(n) === WHITE) visit(n);
  return cycles;
}

/** 層破り(package→app/demo など下位→上位)を検出。 */
function findLayerViolations(nodes, nameToLayer) {
  const rank = { package: 0, app: 1, demo: 1 };
  const violations = [];
  for (const [name, { layer, deps }] of nodes) {
    for (const dep of deps) {
      const depLayer = nameToLayer.get(dep);
      if (!depLayer) continue;
      if (rank[depLayer] > rank[layer]) violations.push({ from: name, to: dep, fromLayer: layer, toLayer: depLayer });
    }
  }
  return violations;
}

const { nodes, nameToLayer } = collect();
const cycles = findCycles(nodes);
const violations = findLayerViolations(nodes, nameToLayer);

// 循環は順序違いの重複を排除
const seen = new Set();
const uniqueCycles = cycles.filter((c) => {
  const key = [...c].sort().join(">");
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`検査対象: ${nodes.size} パッケージ`);
let failed = false;
if (uniqueCycles.length > 0) {
  failed = true;
  console.error(`\n❌ 循環依存 ${uniqueCycles.length} 件:`);
  for (const c of uniqueCycles) console.error("   " + c.join(" → "));
}
if (violations.length > 0) {
  failed = true;
  console.error(`\n❌ 層破り ${violations.length} 件(下位→上位への依存):`);
  for (const v of violations) console.error(`   ${v.from}(${v.fromLayer}) → ${v.to}(${v.toLayer})`);
}
if (!failed) console.log(`✅ 循環依存なし・層破りなし(${nodes.size} パッケージを検査)`);
process.exit(failed ? 1 : 0);
