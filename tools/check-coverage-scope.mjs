#!/usr/bin/env node
/**
 * **カバレッジが「人が書いた実装」だけを測っているか**を見る。
 *
 * 【なぜ要るか】
 * 2026-08 の初回計測で、**生成物・設定ファイル・`tools/` まで分母に入って**いた。
 * `apps/<アプリ>/src/generated/prisma`(`.wasm-base64.js` まで)や
 * `tools/smoke.mjs`(24,518 行)が数えられ、全体が **16%** と出た。
 *
 * この状態には 2 つの問題がある:
 *
 * 1. **意味が無い。** 生成物にテストを書くことはない
 * 2. **下限ラチェットが機能しない。** 検査を 1 本足すだけで割合が下がり、
 *    **テストを何も減らしていないのに CI が落ちる**——
 *    そして落ちた CI は「とりあえず外す」で無効化される
 *
 * 【何を見るか】
 * 1. ルートに `vitest.config.ts` があり、`coverage.include` で対象を絞っているか
 *    (**ワークスペース実行ではカバレッジ設定はルートしか効かない**)
 * 2. 生成物が除外されているか
 * 3. 実際に出た `coverage-summary.json` に、**測ってはいけないもの**が入っていないか
 *    (計測前は 1・2 だけを見る)
 *
 * 実行: node tools/check-coverage-scope.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(ROOT, "vitest.config.ts");
const SUMMARY = path.join(ROOT, "coverage", "coverage-summary.json");

/**
 * 分母に入っていてはいけないもの。**理由を添える。**
 */
const FORBIDDEN = [
  { re: /\/generated\//, why: "生成物(Prisma クライアントなど)。直しようがない" },
  { re: /\.generated\./, why: "生成物" },
  { re: /^tools\//, why: "検査・生成ツール。増やすたびに割合が下がる" },
  { re: /\.config\.(ts|mjs|js)$/, why: "設定ファイル" },
  { re: /\/prisma\/seed\.ts$/, why: "初期データ投入。実行して確かめるもの" },
  { re: /\.test\.(ts|tsx|mts)$/, why: "テストそのもの" },
  { re: /\.d\.ts$/, why: "型だけのファイル(実行される行が無い)" },
];

const problems = [];

// ---- 1・2. 設定を見る ----
if (!existsSync(CONFIG)) {
  problems.push(
    "ルートに vitest.config.ts がありません。" +
      "**ワークスペース実行ではカバレッジ設定はルートしか効きません**" +
      "(各パッケージの vitest.config.ts に書いても使われません)",
  );
} else {
  const cfg = readFileSync(CONFIG, "utf8");
  if (!/coverage\s*:/.test(cfg)) {
    problems.push("vitest.config.ts に coverage の設定がありません");
  }
  if (!/include\s*:\s*\[/.test(cfg)) {
    problems.push(
      "vitest.config.ts の coverage に include がありません。" +
        "絞らないと tools / 生成物 / 設定まで分母に入ります",
    );
  }
  if (!/generated/.test(cfg)) {
    problems.push("vitest.config.ts の coverage で生成物(generated)を除外していません");
  }
  if (/thresholds\s*:/.test(cfg)) {
    problems.push(
      "vitest.config.ts に thresholds があります。" +
        "判定は tools/check-coverage.mjs(下限ラチェット)に一本化してください",
    );
  }
}

// ---- 3. 実際の計測結果を見る ----
let measured = 0;
const leaked = new Map();
if (existsSync(SUMMARY)) {
  const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
  for (const file of Object.keys(summary)) {
    if (file === "total") continue;
    measured += 1;
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    for (const f of FORBIDDEN) {
      if (!f.re.test(rel)) continue;
      if (!leaked.has(f.why)) leaked.set(f.why, []);
      leaked.get(f.why).push(rel);
      break;
    }
  }
}

if (problems.length === 0 && leaked.size === 0) {
  const note = measured > 0
    ? `${measured} ファイルを計測`
    : "計測結果はまだありません(`pnpm test:coverage` の後に見ます)";
  console.log(`✅ カバレッジの対象は絞られています(設定 4 項目を確認 / ${note})`);
  process.exit(0);
}

console.error("❌ カバレッジの測定対象が正しくありません:");
for (const p of problems) console.error(`   ・${p}`);
for (const [why, files] of leaked) {
  console.error(`   ・分母に入ってはいけないものが ${files.length} 件(${why}):`);
  for (const f of files.slice(0, 3)) console.error(`       ${f}`);
  if (files.length > 3) console.error(`       …ほか ${files.length - 3} 件`);
}
console.error("");
console.error("   直す場所は **ルートの vitest.config.ts** です");
console.error("   (各パッケージの vitest.config.ts に書いても、ワークスペース実行では効きません)。");
process.exit(1);
