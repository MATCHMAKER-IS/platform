/**
 * 生成物(module-list.md / advisor-report.md / platform-report.md)がコミット済みの内容と一致するか検査。
 * 生成し直して差分が出れば「生成物が古い」と失敗させる(CI で drift を防ぐ)。
 *   node tools/check-generated.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const checks = [
  { gen: ["tools/gen-module-list.mjs"], file: "docs/ai/module-list.md" },
  { gen: ["tools/advisor.mjs", "report"], file: "docs/ai/advisor-report.md" },
  { gen: ["tools/gen-reference.mjs"], file: "docs/platform/api-reference.json" },
  { gen: ["tools/gen-erd.mjs", "internal-app"], file: "docs/platform/erd/internal-app.md" },
  { gen: ["tools/gen-erd.mjs", "crud-template"], file: "docs/platform/erd/crud-template.md" },
  { gen: ["tools/gen-erd.mjs", "equipment-app"], file: "docs/platform/erd/equipment-app.md" },
  { gen: ["tools/gen-app-map.mjs", "internal-app"], file: "docs/platform/appmap/internal-app.md" },
  { gen: ["tools/gen-app-map.mjs", "crud-template"], file: "docs/platform/appmap/crud-template.md" },
  { gen: ["tools/gen-depgraph.mjs"], file: "docs/platform/depgraph.md" },
  // 使用例のソース(実行時に読まないよう固めたもの。古いとデモサイトの表示が実態とずれる)
  { gen: ["tools/gen-example-sources.mjs"], file: "demos/showcase/src/lib/example-sources.generated.ts" },
];

let ng = 0;
for (const c of checks) {
  const before = readFileSync(path.join(ROOT, c.file), "utf8");
  execFileSync("node", c.gen, { cwd: ROOT, stdio: "ignore" });
  const after = readFileSync(path.join(ROOT, c.file), "utf8");
  // platform-report は生成日を含むので日付行を無視して比較
  const norm = (s) => s.replace(/生成日: \d{4}-\d{2}-\d{2}/g, "生成日: DATE");
  if (norm(before) !== norm(after)) {
    console.error(`❌ ${c.file} が古い可能性(生成し直すと差分)。\`node ${c.gen.join(" ")}\` を実行してコミットしてください`);
    ng += 1;
  } else {
    console.log(`✅ ${c.file} は最新`);
  }
}
if (ng > 0) process.exitCode = 1;
