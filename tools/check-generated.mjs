/**
 * 生成物(module-list.md / advisor-report.md / platform-report.md)がコミット済みの内容と一致するか検査。
 * 生成し直して差分が出れば「生成物が古い」と失敗させる(CI で drift を防ぐ)。
 *   node tools/check-generated.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/**
 * `apps/` のうち、指定したパスを持つものを返す。
 *
 * @param marker 存在を確かめる相対パス(例 `"prisma/schema.prisma"`)
 * @returns アプリ名(昇順)
 */
function appsWith(marker) {
  return readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(ROOT, "apps", d.name, marker)))
    .map((d) => d.name)
    .sort();
}

const checks = [
  { gen: ["tools/gen-module-list.mjs"], file: "docs/ai/module-list.md" },
  // **smoke の索引**(20,620 行から探すため。古いと別のセクションへ飛ぶ)
  { gen: ["tools/gen-smoke-index.mjs"], file: "docs/ai/smoke-index.md" },
  // **資料の参照関係**(2026-08 新設)。76 件がどう繋がっているかは
  // **開いてリンクを辿らないと分からない**ので図にした
  { gen: ["tools/gen-docs-graph.mjs"], file: "docs/DOCS_GRAPH.md" },
  // **参照サイト**(基盤とアプリの HTML 一覧)。2026-08 まで `gen-all` に
  // 入っているのに**ここで検査されておらず**、生成し忘れると古いまま公開された
  { gen: ["tools/gen-ref-site.mjs"], file: "docs/site/index.html" },
  { gen: ["tools/advisor.mjs", "report"], file: "docs/ai/advisor-report.md" },
  { gen: ["tools/gen-reference.mjs"], file: "docs/platform/api-reference.json" },
  // **アプリ名を手で並べない。** 増減のたびに必ず追随が漏れる。
  // equipment-app / balance-app を統合したとき、ここだけ古いまま残って
  // 「存在しないアプリの生成物が無い」で gen:all が落ちた。
  // ER 図は schema.prisma があるアプリ、画面・API 一覧は src/app があるアプリ。
  ...appsWith("prisma/schema.prisma").map((a) => (
    { gen: ["tools/gen-erd.mjs", a], file: `apps/${a}/docs/erd.md` })),
  ...appsWith("src/app").map((a) => (
    { gen: ["tools/gen-app-map.mjs", a], file: `apps/${a}/docs/appmap.md` })),
  { gen: ["tools/gen-depgraph.mjs"], file: "docs/platform/depgraph.md" },
  // 使用例のソース(実行時に読まないよう固めたもの。古いとデモサイトの表示が実態とずれる)
  { gen: ["tools/gen-example-sources.mjs"], file: "apps/showcase/src/lib/example-sources.generated.ts" },
  // 基盤ポータルの API リファレンス。**TSDoc を直したのに再生成を忘れると、
  // ポータルが古い引数・戻り値を出し続ける**(誰も気づけない)。api-reference.json の後に走らせること。
  { gen: ["tools/gen-portal-reference.mjs"], file: "apps/showcase/src/lib/portal-reference.generated.ts" },
  // 基盤ポータルの付加情報(構成・ヘルス・ADR・Advisor・設計)。
  // **apps/platform-portal から移設**。実行時にファイルを読まないよう固める
  { gen: ["tools/gen-portal-extras.mjs"], file: "apps/showcase/src/lib/portal-extras.generated.ts" },
  { gen: ["tools/gen-docs-index.mts"], file: "apps/showcase/public/docs-index.json" },
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
