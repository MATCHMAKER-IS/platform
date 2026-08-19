#!/usr/bin/env node
/**
 * **publish の直前に、`packages/<名前>/package.json` を配れる形へ整える。**
 *
 * ```bash
 * node tools/prepare-publish.mjs --version 2026.8.0
 * node tools/prepare-publish.mjs --version 2026.8.0 --dry   # 書き換えずに見るだけ
 * ```
 *
 * 【なぜ要るか】
 * 手元では `workspace:*`（同じリポジトリのソースを直接見る）で動かしています。
 * これは**開発中は速くて正しい**のですが、**そのままでは配れません**
 * ——受け取った側に `packages/` は無いからです。
 *
 * publish の直前に、次の 3 つを書き換えます。
 *
 *  1. `version` … `0.1.0` 固定 → タグの版（**120 個すべて同じ値**）
 *  2. `private` … `true` を外す（付いていると npm が publish を拒む）
 *  3. 依存の `workspace:*` → `^<版>`（受け取る側はレジストリから取る）
 *
 * 【**コミットに戻さないでください**】
 * この書き換えは **CI の中だけ**のものです。手元に戻すと、
 * **`workspace:*` が消えて開発が遅くなります**（毎回 publish 待ちになる）。
 * `.github/workflows/publish-packages.yml` は checkout 直後の使い捨てで走るので、
 * リポジトリには影響しません。
 *
 * 【スコープの改名について】
 * このツールは**改名しません**。`@platform/*` → `@mtmk-cc/*` の改名は
 * **一度きりの作業**で、リポジトリに残すものだからです（ADR-0026）。
 * 改名前に走らせると、`@platform/*` のまま publish しようとして
 * **GitHub Packages に弾かれます**（スコープが Organization 名と違うため）。
 *
 * @packageDocumentation
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");

const vIndex = process.argv.indexOf("--version");
const version = vIndex >= 0 ? process.argv[vIndex + 1] : undefined;
if (version === undefined || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("❌ --version が要ります（例: --version 2026.8.0）");
  console.error("   タグ `v2026.8.0` から `v` を外した形で渡してください");
  process.exit(1);
}

/**
 * `workspace:*` を版の指定に置き換える。
 *
 * **`^` を付けます。** 受け取る側が「同じ月の修正版」を自動で拾えるように
 * するためです——`2026.8.0` で固定すると、`2026.8.1` を出しても
 * **アプリ側が手で上げるまで届きません**。
 *
 * @param deps 依存の一覧（書き換えて返す）
 * @param v 付ける版
 * @returns 置き換えた数
 */
function rewriteDeps(deps, v) {
  if (deps === undefined) return 0;
  let n = 0;
  for (const [name, range] of Object.entries(deps)) {
    if (typeof range !== "string" || !range.startsWith("workspace:")) continue;
    deps[name] = `^${v}`;
    n += 1;
  }
  return n;
}

const pkgsDir = path.join(ROOT, "packages");
let changed = 0;
let rewritten = 0;
const notPublishable = [];

for (const name of readdirSync(pkgsDir)) {
  const file = path.join(pkgsDir, name, "package.json");
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, "utf8"));

  // **スコープが違うものは配れない。** 気づかず publish すると
  // 「一部だけ古い版のまま」という**いちばん厄介な形**になる
  if (typeof pkg.name === "string" && !pkg.name.startsWith("@mtmk-cc/")) {
    notPublishable.push(pkg.name);
  }

  pkg.version = version;
  delete pkg.private;
  rewritten += rewriteDeps(pkg.dependencies, version);
  rewritten += rewriteDeps(pkg.peerDependencies, version);
  // **devDependencies は書き換えません。** 配る先では使わないので、
  // `workspace:*` のままでも publish を邪魔しません

  if (!dry) writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  changed += 1;
}

if (notPublishable.length > 0) {
  console.error(`\n❌ スコープが \`@mtmk-cc/\` でないパッケージが ${notPublishable.length} 件あります`);
  for (const n of notPublishable.slice(0, 10)) console.error(`   ${n}`);
  if (notPublishable.length > 10) console.error(`   …ほか ${notPublishable.length - 10} 件`);
  console.error("\n   GitHub Packages は**スコープが Organization 名と一致していないと弾きます**。");
  console.error("   改名は一度きりの作業です（ADR-0026）。`node tools/rename-scope.mjs` を先に実行してください");
  process.exit(1);
}

console.log(`✅ ${changed} パッケージを版 ${version} に整えました（workspace 依存 ${rewritten} 件を置換）${dry ? "（--dry のため書き込みなし）" : ""}`);
console.log("   ※ この書き換えは CI の中だけのものです。**コミットに戻さないでください**");
