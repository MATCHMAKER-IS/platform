/**
 * すべての生成物をまとめて再生成する。個別ツールを正しい順序で 2 パス実行し、
 * 相互参照（module-list ↔ advisor など）の取りこぼしを防ぐ。
 *   node tools/gen-all.mjs
 *
 * 生成対象: module-list / advisor-report / api-reference / depgraph / app-map / erd /
 *           platform-report / api-surface / reference-site。
 * 最後に check-generated で drift ゼロを確認する。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;

/** 生成ステップ(順序に意味がある。2 パス回す)。 */
const STEPS = [
  ["gen-module-list.mjs"],
  ["advisor.mjs", "report"],
  ["gen-reference.mjs"],
  ["gen-depgraph.mjs"],
  ["gen-app-map.mjs"],
  ["gen-erd.mjs"],
  ["platform-report.mjs"],
];

function run(args, { quiet = true } = {}) {
  const r = spawnSync("node", [path.join(ROOT, "tools", args[0]), ...args.slice(1)], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
  });
  return r.status ?? 1;
}

function main() {
  console.log("▶ 生成物を再生成します(2 パス)…");
  for (let pass = 1; pass <= 2; pass += 1) {
    for (const step of STEPS) {
      const code = run(step);
      if (code !== 0) {
        console.error(`❌ 失敗: tools/${step.join(" ")}`);
        process.exit(1);
      }
    }
    process.stdout.write(`  pass ${pass} 完了\n`);
  }
  // api-surface は --update で差分を取り込む
  run(["api-surface.mjs", "--update"]);
  // api-surface 更新後に module-list / advisor をもう一度回す(export 数の変化を確実に反映)
  run(["gen-module-list.mjs"]);
  run(["advisor.mjs", "report"]);
  // リファレンスサイト(最新生成物から)
  run(["gen-ref-site.mjs"]);

  console.log("▶ drift 検査(check-generated)…");
  const code = run(["check-generated.mjs"], { quiet: false });
  if (code !== 0) {
    console.error("❌ 生成物に差分が残っています。上のログを確認してください。");
    process.exit(1);
  }
  console.log("✅ すべての生成物が最新です。");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
