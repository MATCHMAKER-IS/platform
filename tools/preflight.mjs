/**
 * オフライン検証ゲートの一括実行(依存インストール不要)。人も CI(boundaries)もこれ1本。
 *   node tools/preflight.mjs      (= pnpm verify:offline)
 * 内容: smoke / check-deps / api-surface(差分検査) / check-schema ×3 / check-env-example / check-doc-numbers / check-ports / check-package-shape / check-docs-links / check-docs-duplication / check-docs-orphans / check-doc-apis / check-e2e-quality / check-app-rules / check-api-auth / check-permissions / check-reimplementation / check-showcase-deps / check-app-transpile / check-jsx-tags / check-a11y / check-pwa / check-maintainability / check-hardcoded-colors / check-contract / check-drill / check-imports / check-build-ready / setup.sh 構文
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const run = (name, cmd, args) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  const ok = r.status === 0;
  const ms = Date.now() - t0;
  const tail = (r.stdout + r.stderr).trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
  console.log(`${ok ? "✅" : "❌"} ${name.padEnd(22)} ${String(ms).padStart(5)}ms  ${tail}`);
  if (!ok) {
    console.error(`----- ${name} の出力 -----`);
    console.error((r.stdout + r.stderr).trim());
    console.error("-".repeat(30));
  }
  return ok;
};

console.log("▶ preflight(オフライン検証ゲート)\n");
let allOk = true;
allOk = run("smoke", "node", ["--experimental-strip-types", "tools/smoke.mjs"]) && allOk;
allOk = run("check-deps", "node", ["tools/check-deps.mjs"]) && allOk;
allOk = run("api-surface(差分)", "node", ["tools/api-surface.mjs"]) && allOk;
for (const app of ["internal-app", "crud-template", "equipment-app"]) {
  allOk = run(`check-schema:${app}`, "node", ["tools/check-schema.mjs", `apps/${app}/prisma/schema.prisma`]) && allOk;
}
allOk = run("check-env-example", "node", ["tools/check-env-example.mjs"]) && allOk;
allOk = run("check-doc-numbers", "node", ["tools/check-doc-numbers.mjs"]) && allOk;  // 手書き資料の数値ドリフト(AIが読む前提資料)
allOk = run("check-ports", "node", ["tools/check-ports.mjs"]) && allOk;  // 開発ポートの重複(pnpm dev は一斉起動するため)
allOk = run("check-package-shape", "node", ["tools/check-package-shape.mjs"]) && allOk;  // tsconfig/scripts 欠落(型チェックが素通りする)
allOk = run("check-docs-links", "node", ["tools/check-docs-links.mjs"]) && allOk;  // 手書き資料のリンク切れ・存在しないコマンド案内
run("check-docs-duplication", "node", ["tools/check-docs-duplication.mjs"]);
allOk = run("check-docs-orphans", "node", ["tools/check-docs-orphans.mjs"]) && allOk;  // どこからも辿り着けない資料を検出  // 資料の重複(警告のみ・CI は落とさない)
allOk = run("check-doc-apis", "node", ["tools/check-doc-apis.mjs"]) && allOk;  // 資料のコード例が実在する API を使っているか
allOk = run("check-e2e-quality", "node", ["tools/check-e2e-quality.mjs"]) && allOk;  // E2E の Flaky リスク(固定待ち等)
allOk = run("check-app-rules", "node", ["tools/check-app-rules.mjs"]) && allOk;  // apps が基盤の役割を侵していないか(CLAUDE.md の規約)
allOk = run("check-api-auth", "node", ["tools/check-api-auth.mjs"]) && allOk;  // 認可も公開宣言も無い API を検出(上限つき)
allOk = run("check-permissions", "node", ["tools/check-permissions.mjs"]) && allOk;  // 使用している権限がポリシーに定義されているか
allOk = run("check-reimplementation", "node", ["tools/check-reimplementation.mjs"]) && allOk;  // 基盤にある機能をアプリで作り直していないか
allOk = run("check-showcase-deps", "node", ["tools/check-showcase-deps.mjs"]) && allOk;  // デモサイトの依存漏れ(ビルドしないと気づけない)
allOk = run("check-app-transpile", "node", ["tools/check-app-transpile.mjs"]) && allOk;  // apps の transpilePackages 漏れ(next build だけが落ちる。typecheck/smoke は通る)
allOk = run("check-jsx-tags", "node", ["tools/check-jsx-tags.mjs"]) && allOk;
allOk = run("check-a11y", "node", ["tools/check-a11y.mjs"]) && allOk;
allOk = run("check-pwa", "node", ["tools/check-pwa.mjs"]) && allOk;  // PWA の設定が揃っているか(壊れても気づきにくい)
allOk = run("check-maintainability", "node", ["tools/check-maintainability.mjs"]) && allOk;  // 次に触る人が読める大きさか(上限つき)
allOk = run("check-hardcoded-colors", "node", ["tools/check-hardcoded-colors.mjs"]) && allOk;  // 色の直書き(テーマを切り替えても変わらない)
allOk = run("check-contract", "node", ["tools/check-contract.mjs"]) && allOk;
allOk = run("check-drill", "node", ["tools/check-drill.mjs"]) && allOk;  // 復元訓練の鮮度(バックアップは戻せて初めて完成する)  // 外部SaaSとの契約(依存フィールド)と実装のズレを検知  // アクセシビリティの静的検査(キーボード操作・読み上げが壊れる実装を検知)  // JSX インラインタグの閉じ忘れ(next build を構文エラーで落とす。tsc 無しでも一次検知)
allOk = run("check-imports", "node", ["tools/check-imports.mjs"]) && allOk;  // 存在しない名前の取り込み(next build が落ちる)
allOk = run("check-build-ready", "node", ["tools/check-build-ready.mjs"]) && allOk;  // next build が通る前提(エントリ/重複export/use client/import)
allOk = run("advisor(dup検出)", "node", ["tools/advisor.mjs", "dup"]) && allOk;
if (existsSync("/bin/bash") || existsSync("/usr/bin/bash")) {
  allOk = run("setup.sh 構文", "bash", ["-n", "scripts/setup.sh"]) && allOk;
  allOk = run("Windows setup 検査", "node", ["tools/check-win-setup.mjs"]) && allOk;
} else {
  console.log("⏭  setup.sh 構文        (bash なしのためスキップ)");
}

console.log("");
if (allOk) {
  console.log("preflight: すべて緑 ✅");
} else {
  console.error("preflight: 失敗あり ❌(上の出力を確認)");
  process.exitCode = 1;
}
