#!/usr/bin/env node
/**
 * **ブラウザ / Edge で動くファイルが、Node.js 専用のものを巻き込んでいないか**を見る。
 *
 * ```bash
 * node tools/check-runtime-boundary.mjs
 * node tools/check-runtime-boundary.mjs --list
 * ```
 *
 * 【なぜ要るか】
 * `"use client"` の画面と `middleware.ts` は **Node.js の外**で動きます。
 * そこへ `node:crypto` などが載ると、ビルドがこう言って落ちます:
 *
 * ```
 * Module build failed: UnhandledSchemeError: Reading from "node:crypto"
 * ```
 *
 * 厄介なのは、**自分では import していない**ことです。
 * `@platform/auth` から `verifyTotp` を取っただけでも、
 * **束ねた入口（`index.ts`）が `totp.ts` を連れてきて**、その中に
 * `node:crypto` があります。**使っていない部分が落ちる原因になります。**
 *
 * 2026-08 に `security` / `pii` / `pdf` の 3 つで同じことが起き、
 * `next build` が 5 アプリすべてで落ちました。
 *
 * 【直し方】
 * **入口を分けます。** Node が要らない部分を別ファイルにして、
 * `package.json` の `exports` にサブパスを足してください:
 *
 * ```json
 * { ".": "./src/index.ts", "./mask": "./src/mask.ts" }
 * ```
 *
 * 呼ぶ側は `@platform/pii/mask` のように**サブパスから取ります**。
 * `ratelimit` / `cron` / `net` の `./browser` が同じ形の先例です。
 *
 * 【それでも巻き込みたいとき】
 * 画面が本当に Node 専用の処理を要るなら、**画面から呼ぶのをやめて**
 * API 経由にしてください。ブラウザで動かない処理を
 * ブラウザに置いても、**動くようにはなりません**。
 *
 * @packageDocumentation
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "generated", ".turbo", "coverage"]);

/**
 * ディレクトリを再帰してソースを集める。
 *
 * @param dir 起点
 * @param out 集めた先（再帰用）
 * @returns ファイルの絶対パス
 */
function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/**
 * コメントと文字列リテラルを消す。
 *
 * **例示のコードを import と数えないため**です——見本を載せている
 * ページが「危ない」と言われると、**検査そのものが信用されなくなります**。
 *
 * @param src ソース
 * @returns 消したあとのソース
 */
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``");
}

/**
 * 入口（`index.ts`）から辿って `node:` に届くパッケージを集める。
 *
 * @returns パッケージ名の集合
 */
function packagesReachingNode() {
  const hit = new Set();
  const pkgDir = path.join(ROOT, "packages");
  for (const name of existsSync(pkgDir) ? readdirSync(pkgDir) : []) {
    const entry = path.join(pkgDir, name, "src", "index.ts");
    if (!existsSync(entry)) continue;
    const seen = new Set();
    const stack = [entry];
    while (stack.length > 0) {
      const f = stack.pop();
      if (seen.has(f) || !existsSync(f)) continue;
      seen.add(f);
      const src = readFileSync(f, "utf8");
      if (/from "node:/.test(stripNoise(src))) { hit.add(name); break; }
      for (const rel of src.matchAll(/from "(\.[^"]+)"/g)) {
        const base = path.join(path.dirname(f), rel[1]);
        for (const cand of [`${base}.ts`, path.join(base, "index.ts")]) {
          if (existsSync(cand)) { stack.push(cand); break; }
        }
      }
    }
  }
  return hit;
}

const nodeOnly = packagesReachingNode();
const problems = [];
let checked = 0;

for (const file of collect(path.join(ROOT, "apps"))) {
  const raw = readFileSync(file, "utf8");
  const isClient = raw.trimStart().startsWith('"use client"');
  const isMiddleware = path.basename(file) === "middleware.ts";
  if (!isClient && !isMiddleware) continue;
  checked += 1;

  const src = stripNoise(raw);
  // **`import type` は数えない。** 型はビルドで消えるので、
  // `node:` を連れてきません——数えると**直しようのない指摘**になり、
  // 検査そのものが信用されなくなります(2026-08 に実際に誤検出した)。
  // 同じ理由で、`{ type Foo }` だけの取り込みも値ではありません。
  for (const m of src.matchAll(/import\s+(type\s+)?(?:\{([^}]*)\}|[\w*\s,]+)\s*from\s*"@platform\/([a-z0-9-]+)"/g)) {
    const pkg = m[3];
    if (!nodeOnly.has(pkg)) continue;
    if (m[1]) continue;                       // `import type { ... }`
    if (m[2] !== undefined) {
      const values = m[2].split(",").map((x) => x.trim()).filter(Boolean)
        .filter((x) => !x.startsWith("type "));
      if (values.length === 0) continue;      // `{ type Foo }` だけ
    }
    problems.push({
      rel: path.relative(ROOT, file).replace(/\\/g, "/"),
      kind: isClient ? "画面(use client)" : "middleware(Edge)",
      pkg,
    });
  }
}

const LIMIT_FILE = path.join(ROOT, "tools/runtime-boundary-limit.json");
/** いま許している件数（**増やさないための歯止め**）。 */
const limit = existsSync(LIMIT_FILE) ? (JSON.parse(readFileSync(LIMIT_FILE, "utf8")).count ?? 0) : 0;

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({
    _comment: "ブラウザ/Edge から Node 専用パッケージを巻き込んでいる箇所の上限。減らしたら --set-limit で下げる。",
    count: problems.length,
  }, null, 2)}\n`);
  console.log(`✅ 上限を刻みました: ${problems.length} 件`);
  process.exit(0);
}

if (problems.length > 0 && process.argv.includes("--list")) {
  for (const p of problems) console.log(`   [${p.kind}] ${p.rel} → @platform/${p.pkg}`);
}

if (problems.length > limit) {
  console.error(`\n❌ ブラウザ / Edge で動くファイルが、Node 専用のものを巻き込んでいます（${problems.length} 件 / 上限 ${limit}）`);
  console.error("   **自分では import していなくても**、束ねた入口が連れてきます。");
  console.error("   `next build` が UnhandledSchemeError で落ちます（手元の dev では出ないことがあります）。\n");
  for (const p of problems) {
    console.error(`   [${p.kind}] ${p.rel}`);
    console.error(`     → @platform/${p.pkg} の入口は node: に届きます。**サブパスに分けてください**`);
  }
  console.error("\n   直し方: Node が要らない部分を別ファイルにし、package.json の exports に足す");
  console.error("   （`\"./mask\": \"./src/mask.ts\"` のように。`ratelimit` の `./browser` が先例）");
  process.exit(1);
}

if (problems.length > 0) {
  console.log(`⚠ ブラウザ / Edge から Node 専用のものを巻き込んでいる箇所が ${problems.length} 件（上限 ${limit}・詳細は --list）`);
  console.log("   **これらは showcase のビルドを落とします。** サブパスに分けて減らしてください");
} else {
  console.log(`✅ ブラウザ / Edge 側から Node 専用のものは巻き込んでいません（${checked} ファイル / node: に届くパッケージ ${nodeOnly.size} 件）`);
}
