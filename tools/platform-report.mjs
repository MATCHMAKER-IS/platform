/**
 * 基盤の健康診断レポートを生成する(Platform Analytics 初版)。
 * 使い方: node tools/platform-report.mjs  → docs/ai/platform-report.md を再生成
 * 見るもの: パッケージ数/README/テスト保有率/実装行数/公開API数/カテゴリ分布、アプリ別の route・client・Prisma モデル数、検証項目数。
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "./package-categories.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => fs.readFileSync(p, "utf8");

function* walk(dir, ext) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
      yield* walk(p, ext);
    } else if (ext.test(e.name)) yield p;
  }
}

// packages 集計
const pkgDir = path.join(root, "packages");
const pkgs = fs.readdirSync(pkgDir).filter((d) => fs.statSync(path.join(pkgDir, d)).isDirectory()).sort();
let readmes = 0, withTest = 0, srcLines = 0, testFiles = 0;
for (const p of pkgs) {
  if (fs.existsSync(path.join(pkgDir, p, "README.md"))) readmes += 1;
  let hasTest = false;
  for (const f of walk(path.join(pkgDir, p, "src"), /\.(ts|tsx)$/)) {
    const lines = read(f).split("\n").length;
    if (/\.test\.tsx?$/.test(f)) { hasTest = true; testFiles += 1; } else srcLines += lines;
  }
  if (hasTest) withTest += 1;
}
const surface = JSON.parse(read(path.join(root, "docs/platform/api-surface.json")));
const exportsTotal = Object.values(surface).reduce((a, v) => a + v.length, 0);

// apps 集計
const apps = ["internal-app", "public-site", "crud-template", "equipment-app"];
const appRows = apps.map((a) => {
  const base = path.join(root, "apps", a);
  let routes = 0, clients = 0;
  for (const f of walk(path.join(base, "src"), /\.(ts|tsx)$/)) {
    if (f.endsWith("route.ts")) routes += 1;
    else if (read(f).startsWith('"use client"')) clients += 1;
  }
  const schema = path.join(base, "prisma/schema.prisma");
  const models = fs.existsSync(schema) ? (read(schema).match(/^model /gm) ?? []).length : 0;
  return { app: a, routes, clients, models };
});

// 検証・ドキュメント
const smoke = read(path.join(root, "tools/smoke.mjs"));
const smokeChecks = (smoke.match(/^\s*ok\(/gm) ?? []).length;
const smokeSections = (smoke.match(/section\(/g) ?? []).length - 1; // 定義分を除く
const adrs = fs.readdirSync(path.join(root, "docs/adr")).filter((f) => /^\d{4}-/.test(f)).length;
const demos = fs.readdirSync(path.join(root, "demos")).filter((d) => fs.statSync(path.join(root, "demos", d)).isDirectory()).length;

const catRows = Object.entries(CATEGORIES).map(([c, list]) => `| ${c} | ${list.filter((p) => pkgs.includes(p)).length} |`).join("\n");
const pct = (n, d) => `${Math.round((n / d) * 100)}%`;

const md = `# 基盤ヘルスレポート(自動生成)

> 再生成: \`node tools/platform-report.mjs\`(手で編集しない)。生成日: ${new Date().toISOString().slice(0, 10)}

## サマリー

| 指標 | 値 |
|---|---|
| パッケージ数 | ${pkgs.length} |
| README 整備率 | ${readmes}/${pkgs.length}(${pct(readmes, pkgs.length)}) |
| ユニットテスト保有パッケージ | ${withTest}/${pkgs.length}(${pct(withTest, pkgs.length)})・テストファイル ${testFiles} |
| 実装行数(packages/src, テスト除く) | ${srcLines.toLocaleString()} 行 |
| 公開 API(export) | ${exportsTotal}(api-surface 追跡) |
| スモーク検証 | ${smokeChecks} チェック / ${smokeSections} セクション(実測は \`pnpm verify:offline\`) |
| ADR | ${adrs} 件 / デモ | ${demos} 本 |

## アプリ

| アプリ | API route | client コンポーネント | Prisma モデル |
|---|---|---|---|
${appRows.map((r) => `| ${r.app} | ${r.routes} | ${r.clients} | ${r.models} |`).join("\n")}

## カテゴリ分布(packages)

| カテゴリ | 数 |
|---|---|
${catRows}

## 使い方(改善の当たりの付け方)

テスト保有率の低いカテゴリ・README の薄い巨大パッケージ・route の多いアプリ(分割候補)から着手する。数値は品質スコアではなく**議論の入口**として使う。
`;
fs.writeFileSync(path.join(root, "docs/ai/platform-report.md"), md);
console.log(`✅ docs/ai/platform-report.md 生成(pkg ${pkgs.length} / README ${readmes} / test ${withTest} / export ${exportsTotal} / smoke ${smokeChecks}チェック)`);
