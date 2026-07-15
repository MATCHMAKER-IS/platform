/**
 * packages/ のカテゴリ別再配置の計画ツール。既定は dry-run(何も変更しない)。
 * npm 名(@platform/<name>)は不変・物理パスのみ packages/<slug>/<name> へ移す前提で、
 * 移動コマンドと「パス直書きの影響箇所」を洗い出す。
 *
 * 使い方:
 *   node tools/migrate-packages.mjs                      # 全カテゴリの計画
 *   node tools/migrate-packages.mjs --category=外部SaaS連携  # 1カテゴリ(パイロット)
 *
 * 実適用は docs/ops/PACKAGE_RECATEGORIZATION_PLAN.md の手順(Phase 1 のツール抽象化が先)。
 * 誤操作防止のため、本ツール自体はファイルを移動しない。
 */
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, CATEGORY_SLUGS } from "./package-categories.mjs";

const root = new URL("..", import.meta.url).pathname;
const arg = process.argv.find((a) => a.startsWith("--category="));
const only = arg ? arg.split("=")[1] : null;

/** パス直書きを探す対象(拡張しやすいよう一覧化)。 */
const SCAN = ["tools", ".github/workflows", "docs", "package.json", "pnpm-workspace.yaml", "turbo.json", "vitest.config.ts", "playwright.config.ts"];

function* walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (p.includes("node_modules") || p.endsWith(".git")) return;
    for (const c of fs.readdirSync(p)) yield* walk(path.join(p, c));
  } else if (/\.(mjs|ts|tsx|yml|yaml|json|md)$/.test(p)) yield p;
}

const files = SCAN.flatMap((s) => {
  const full = path.join(root, s);
  return fs.existsSync(full) ? [...walk(full)] : [];
});

let totalMoves = 0;
const impactByFile = new Map();

for (const [cat, pkgs] of Object.entries(CATEGORIES)) {
  if (only && cat !== only) continue;
  const slug = CATEGORY_SLUGS[cat];
  const present = pkgs.filter((p) => fs.existsSync(path.join(root, "packages", p)));
  if (present.length === 0) continue;
  console.log(`\n■ ${cat} → packages/${slug}/  (${present.length} 個)`);
  for (const p of present) {
    console.log(`  git mv packages/${p} packages/${slug}/${p}`);
    totalMoves += 1;
    const needle = `packages/${p}/`;
    for (const f of files) {
      const body = fs.readFileSync(f, "utf8");
      const count = body.split(needle).length - 1;
      if (count > 0) {
        const rel = path.relative(root, f);
        impactByFile.set(rel, (impactByFile.get(rel) ?? 0) + count);
      }
    }
  }
}

console.log(`\n── パス直書きの影響(移動後に書換えが必要な箇所) ──`);
const sorted = [...impactByFile.entries()].sort((a, b) => b[1] - a[1]);
for (const [f, c] of sorted) console.log(`  ${String(c).padStart(4)} 箇所  ${f}`);
if (sorted.length === 0) console.log("  なし");

console.log(`\n── ワークスペース設定の変更(移行期間は両グロブ併記) ──`);
console.log(`  pnpm-workspace.yaml: packages/* に加えて "packages/*/*" を追加(全移行後に packages/* を削除)`);
console.log(`\n合計: ${totalMoves} パッケージ移動 / 影響ファイル ${sorted.length} 件(dry-run・変更なし)`);
console.log(`実適用の手順: docs/ops/PACKAGE_RECATEGORIZATION_PLAN.md`);
