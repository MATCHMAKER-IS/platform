/**
 * 生成物(module-list.md / advisor-report.md / platform-report.md)がコミット済みの内容と一致するか検査。
 * 生成し直して差分が出れば「生成物が古い」と失敗させる(CI で drift を防ぐ)。
 *   node tools/check-generated.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
  // 基盤ポータルの API リファレンス。**TSDoc を直したのに再生成を忘れると、
  // ポータルが古い引数・戻り値を出し続ける**(誰も気づけない)。api-reference.json の後に走らせること。
  { gen: ["tools/gen-portal-reference.mjs"], file: "demos/showcase/src/lib/portal-reference.generated.ts" },
  { gen: ["tools/gen-docs-index.mts"], file: "demos/showcase/public/docs-index.json" },
];

let ng = 0;
for (const c of checks) {
  const fp = path.join(ROOT, c.file);
  const before = readFileSync(fp, "utf8");
  // .mts(型を含む)は型ストリップを有効にして実行する
  const flags = c.gen[0].endsWith(".mts") ? ["--experimental-strip-types"] : [];
  execFileSync("node", [...flags, ...c.gen], { cwd: ROOT, stdio: "ignore" });
  const after = readFileSync(fp, "utf8");
  // 「検査」はワークツリーを変更しない。比較のために再生成で書き換わった内容を元へ戻す
  // (drift の有無にかかわらず、実行前後でファイルを同一に保つ。中断・失敗時に汚さない。
  //  更新は本来の担当 `gen-all.mjs` / `platform:sync` が行う)。
  if (after !== before) writeFileSync(fp, before);
  // 生成物には「いつ生成したか」が入るものがある。そこだけは差分から除いて比較する。
  // これが無いと **コミットした翌日から毎日 CI が赤くなる**(内容は 1 バイトも変わっていないのに)。
  // 恒常的に赤いゲートは「赤を無視する習慣」を作り、本物の drift を埋もれさせるので、
  // 新しく時刻入りの生成物を足したときは、ここに正規化を追加すること。
  //   - `生成日: 2026-07-24`      … advisor-report.md / platform-report.md(Markdown)
  //   - `"generatedAt": "..."`    … docs-index.json(JSON。画面に表示するので消せない)
  const norm = (s) =>
    s
      .replace(/生成日: \d{4}-\d{2}-\d{2}/g, "生成日: DATE")
      .replace(/"generatedAt":\s*"[^"]*"/g, '"generatedAt": "DATE"');
  if (norm(before) !== norm(after)) {
    console.error(`❌ ${c.file} が古い可能性(生成し直すと差分)。\`node ${c.gen.join(" ")}\` を実行してコミットしてください`);
    // **何が違うのかを出す。** 「差分がある」だけでは直しようがない。
    // 環境差(改行コード・ロケール・生成物の混入)を切り分けるのに要る。
    const a = norm(before).split("\n");
    const b = norm(after).split("\n");
    if (a.length !== b.length) console.error(`     行数: コミット済み ${a.length} / 生成後 ${b.length}`);
    for (let i = 0, shown = 0; i < Math.max(a.length, b.length) && shown < 3; i += 1) {
      if (a[i] === b[i]) continue;
      const cut = (t) => (t === undefined ? "(行なし)" : t.length > 120 ? `${t.slice(0, 120)}…` : t);
      console.error(`     ${i + 1} 行目:`);
      console.error(`       コミット済み: ${cut(a[i])}`);
      console.error(`       生成後      : ${cut(b[i])}`);
      shown += 1;
    }
    ng += 1;
  } else {
    console.log(`✅ ${c.file} は最新`);
  }
}
if (ng > 0) process.exitCode = 1;
