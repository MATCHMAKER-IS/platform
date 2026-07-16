/**
 * オフライン検証ゲートの一括実行(依存インストール不要)。人も CI(boundaries)もこれ1本。
 *   node tools/preflight.mjs      (= pnpm verify:offline)
 * 内容: smoke / check-deps / api-surface(差分検査) / check-schema ×3 / check-env-example / check-doc-numbers / check-ports / check-package-shape / check-docs-links / check-docs-duplication / check-e2e-quality / check-app-rules / check-showcase-deps / check-build-ready / setup.sh 構文
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
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
run("check-docs-duplication", "node", ["tools/check-docs-duplication.mjs"]);  // 資料の重複(警告のみ・CI は落とさない)
allOk = run("check-e2e-quality", "node", ["tools/check-e2e-quality.mjs"]) && allOk;  // E2E の Flaky リスク(固定待ち等)
allOk = run("check-app-rules", "node", ["tools/check-app-rules.mjs"]) && allOk;  // apps が基盤の役割を侵していないか(CLAUDE.md の規約)
allOk = run("check-showcase-deps", "node", ["tools/check-showcase-deps.mjs"]) && allOk;  // デモサイトの依存漏れ(ビルドしないと気づけない)
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
