/**
 * 各アプリ(apps/*)の next.config.mjs の `transpilePackages` が、
 * package.json の `@platform/*` 依存を**すべて**含むかを検査する。
 *
 * なぜ必要か: 基盤パッケージは main が `src/index.ts`(生 TS)を指す。next.config の
 * transpilePackages に載らないパッケージを import すると **next build だけが落ちる**
 * (typecheck も smoke も通るため、ビルドするまで気づけない)。showcase 用の
 * check-showcase-deps はデモしか見ないので、アプリ側はこのツールで担保する。
 *
 * config を **実際に import** して評価するため、transpilePackages を package.json から
 * 動的生成していても正しく検査できる。
 *
 *   node tools/check-app-transpile.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const appsDir = path.join(ROOT, "apps");

let bad = 0;
let checked = 0;
for (const app of fs.readdirSync(appsDir).sort()) {
  const dir = path.join(appsDir, app);
  const pj = path.join(dir, "package.json");
  const cfg = ["next.config.mjs", "next.config.js"]
    .map((f) => path.join(dir, f))
    .find((f) => fs.existsSync(f));
  if (!fs.existsSync(pj) || !cfg) continue;

  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) =>
    d.startsWith("@platform/"),
  );

  let listed;
  try {
    const mod = await import(pathToFileURL(cfg).href);
    listed = new Set(mod.default?.transpilePackages ?? []);
  } catch (e) {
    bad += 1;
    console.error(`❌ ${app}: next.config の読み込みに失敗しました(${e.message})`);
    continue;
  }

  const missing = deps.filter((d) => !listed.has(d));
  checked += 1;
  if (missing.length > 0) {
    bad += 1;
    console.error(
      `❌ ${app}: transpilePackages に ${missing.length} 件不足(next build で失敗します): ${missing.join(", ")}`,
    );
  } else {
    console.log(`✅ ${app}: transpilePackages OK(@platform 依存 ${deps.length} 件すべて記載)`);
  }
}

if (bad > 0) {
  console.error(
    `\n${bad} 件のアプリで transpilePackages が不足しています。next.config.mjs で package.json の @platform/* 依存から導出してください。`,
  );
  process.exitCode = 1;
} else {
  console.log(`\n✅ 全 ${checked} アプリの transpilePackages は @platform 依存を網羅しています`);
}
