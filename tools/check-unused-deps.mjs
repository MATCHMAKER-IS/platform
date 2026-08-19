#!/usr/bin/env node
/**
 * **依存に入れたまま、一度も import していないパッケージ**を見る。
 *
 * 【`check-app-transpile` との違い】
 * あちらは「**import しているのに宣言が無い**」を見ます（ビルドが落ちる方）。
 * こちらは**逆向き**——「**宣言はあるが使っていない**」です。
 *
 * 【なぜ気にするか】
 * 落ちはしません。ですが次の形で効いてきます:
 *
 * | | |
 * |---|---|
 * | **入れるものが増える** | `pnpm install` が遅くなり、Docker のイメージも大きくなる |
 * | **「使っている」と誤解される** | 依存グラフに線が引かれ、`impact.mjs` が「影響あり」と出す |
 * | **消してよいか分からなくなる** | 半年後、**誰も使っていないのに消せない**——「たぶん要る」で残る |
 *
 * 【`pnpm new-app` で選べるようになった影響】
 * 2026-08 に**全 120 パッケージを選択肢に出した**ため、
 * **「とりあえず全部入れる」ができるようになりました**。
 * 選ぶのは簡単ですが、**使わなかったものは残ります**——
 * この検査は、その後始末を促すためのものです。
 *
 * 【消す前に考えること】
 * **「これから使う」なら残して構いません。** その場合は
 * `package.json` の `platform.plannedDeps` に理由付きで書いてください
 * ——**書けば咎めません**。咎めているのは「なぜ入っているか誰も知らない」状態です。
 *
 * 実行: node tools/check-unused-deps.mjs [--list]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "unused-deps-limit.json");

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "coverage", "generated"]);

/**
 * 見逃してよいもの。**理由を必ず書く。**
 */
const ALLOW = new Set([
  // **設定は import しない。** `tsconfig` / `eslint` が名前で参照する
  "@platform/config",
  // **型と副作用のためだけに入れることがある。** `next.config.mjs` から
  // 読まれる・ビルド時にだけ効く、といったもの
  "@platform/theme",
]);

/** そのディレクトリ配下で import されている `@platform/*` を集める。 */
function importedIn(dir) {
  const found = new Set();
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|mts|mjs|js|jsx)$/.test(e.name)) continue;
      const body = readFileSync(p, "utf8");
      for (const m of body.matchAll(/["'`](@platform\/[a-z0-9-]+)(?:\/[^"'`]*)?["'`]/g)) {
        found.add(m[1]);
      }
    }
  };
  // **`src` だけでなく設定ファイルも見る。** `next.config.mjs` や
  // `prisma/seed.ts` から使っているものを「未使用」と言わないため
  walk(path.join(dir, "src"));
  walk(path.join(dir, "prisma"));
  walk(path.join(dir, "e2e"));
  for (const f of ["next.config.mjs", "tailwind.config.ts", "vitest.config.ts"]) {
    const p = path.join(dir, f);
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, "utf8").matchAll(/["'`](@platform\/[a-z0-9-]+)/g)) found.add(m[1]);
  }
  return found;
}

const apps = readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const findings = [];
/** すでに繋がったのに `plannedDeps` に残っているもの。 */
const stalePlanned = [];
let scanned = 0;

for (const app of apps) {
  const dir = path.join(ROOT, "apps", app);
  const pkgPath = path.join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  scanned += 1;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  // **`dependencies` だけを見る。**
  //
  // `devDependencies` は**本番の成果物に入りません**——負荷試験の道具や
  // 型定義のように、**手元でだけ使うもの**が入ります。
  // 「import していない」ことが問題になるのは、
  // **本番に載るのに使っていない**場合だけです(2026-08)。
  const declared = Object.keys(pkg.dependencies ?? {})
    .filter((d) => d.startsWith("@platform/"));
  // **「これから使う」と宣言してあるものは咎めない。**
  const planned = new Set(Object.keys(pkg.platform?.plannedDeps ?? {}));
  const used = importedIn(dir);

  for (const d of declared) {
    if (used.has(d) || ALLOW.has(d) || planned.has(d)) continue;
    findings.push(`${app}: ${d}`);
  }

  // **「これから使う」が、もう使われているなら宣言は要らない。**
  //
  // `plannedDeps` は**約束のメモ**です。実際に繋いだら消してください
  // ——残っていると、**次に同じものを外したときに咎められません**
  // （「これから使う」と書いてあるので）。
  // **落とさず知らせるだけ**にしてあります（消すのは人が決めること）。
  for (const d of planned) {
    if (used.has(d)) stalePlanned.push(`${app}: ${d}`);
  }
}

const limit = existsSync(LIMIT_FILE)
  ? JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit ?? 0
  : 0;

if (stalePlanned.length > 0) {
  console.log(`⚠ もう使っているのに plannedDeps に残っているものが ${stalePlanned.length} 件あります:`);
  for (const p2 of stalePlanned) console.log(`   ${p2}`);
  console.log("   繋いだら宣言は消してください（残すと、次に外したときに咎められません）");
}

if (process.argv.includes("--list")) {
  for (const f of findings) console.log(`   ${f}`);
}

if (findings.length === 0) {
  console.log(`✅ 依存に入れたまま使っていないものはありません(${scanned} アプリを検査)`);
  process.exit(0);
}

if (findings.length <= limit) {
  console.log(`⚠ 使っていない依存 ${findings.length} 件(上限 ${limit}・詳細は --list / ${scanned} アプリを検査)`);
  process.exit(0);
}

console.error(`❌ 依存に入れたまま使っていないものが ${findings.length} 件あります(上限 ${limit}):`);
for (const f of findings.slice(0, 12)) console.error(`   ${f}`);
if (findings.length > 12) console.error(`   （ほか ${findings.length - 12} 件）`);
console.error("");
console.error("   **落ちはしませんが、入れるものが増え、消してよいか分からなくなります。**");
console.error("   使わないなら package.json から消してください。");
console.error("   これから使うなら、package.json の platform.plannedDeps に理由を書けば咎めません:");
console.error('     "platform": { "plannedDeps": { "@platform/mail": "通知機能で使う予定(2026-09)" } }');
process.exit(1);
