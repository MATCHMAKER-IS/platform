#!/usr/bin/env node
/**
 * **上限に「たるみ」が無いかを確かめる(実測 < 上限になっていないか)。**
 *
 * 【なぜ要るか】
 * 上限方式の穴はここ 1 点しかない。**直したのに上限を下げ忘れる**と、
 * その差分だけ後戻りが素通りする。しかも検査は緑のままなので気づけない。
 *
 * 例: `check-hardcoded-colors` の上限が 5 のまま実測 0 になっていると、
 * 色を 5 か所まで直書きしても検査は通る。**守れているように見えて守っていない**。
 *
 * この基盤は「緑でも守れていない範囲」を何度も踏んでいる
 * (`check-docs-links` が `docs/` しか見ていなかった、
 * `check-doc-numbers` の除外一覧が実態と食い違っていた、など)。
 * たるみはその中でも**機械で完全に判定できる**種類なので、必ず止める。
 *
 * 【直し方】
 *   node tools/debt.mjs --tighten
 * を流して、上限ファイルの差分を commit するだけ。
 *
 * 実行: node tools/check-debt-slack.mjs
 */
import { existsSync, readFileSync, copyFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 上限ファイルと、それを詰める**コマンド**。
 *
 * **フラグを `--set-limit` と決め打ちしない。** 2026-08 に、
 * `app-bypass-limit.json` だけ `--set-bypass-limit` という別名だったため、
 * 実測 1 に対して上限 2 のたるみを**この検査自身が見逃した**。
 * 検査を足しても対象が狭ければ通り抜ける、という同じ穴をここでも踏んだ。
 */
const LIMIT_FILES = [
  { file: "tools/api-auth-limit.json", by: "check-api-auth" },
  { file: "tools/app-bypass-limit.json", by: "check-app-rules", flag: "--set-bypass-limit" },
  { file: "tools/ui-raw-tag-limit.json", by: "check-app-rules" },
  { file: "tools/handmade-chart-limit.json", by: "check-handmade-chart" },
  { file: "tools/hardcoded-colors-limit.json", by: "check-hardcoded-colors" },
  { file: "tools/hardcoded-colors-app-limit.json", by: "check-hardcoded-colors" },
  { file: "tools/maintainability-limit.json", by: "check-maintainability" },
  { file: "tools/reimplementation-limit.json", by: "check-reimplementation" },
  { file: "tools/tsdoc-params-limit.json", by: "check-tsdoc-params" },
  { file: "tools/utc-date-limit.json", by: "check-utc-date" },
  { file: "tools/api-error-shape-limit.json", by: "check-api-error-shape" },
  { file: "tools/css-vars-limit.json", by: "check-css-vars" },
  { file: "tools/ime-enter-limit.json", by: "check-ime-enter" },
];

/**
 * `--set-limit` を**退避してから**流し、結果を比べて元に戻す。
 *
 * **検査が副作用でファイルを書き換えてはいけない。** 検査を流しただけで
 * 上限が下がると、「下げた」という判断が記録に残らないまま進んでしまう。
 */
const backups = new Map();
for (const { file } of LIMIT_FILES) {
  const p = path.join(ROOT, file);
  if (!existsSync(p)) continue;
  const bak = `${p}.slackbak`;
  copyFileSync(p, bak);
  backups.set(p, bak);
}

const runs = new Map();
for (const l of LIMIT_FILES) runs.set(`${l.by}|${l.flag ?? "--set-limit"}`, l);
for (const k of runs.keys()) {
  const [tool, flag] = k.split("|");
  spawnSync(process.execPath, [path.join(ROOT, "tools", `${tool}.mjs`), flag],
    { cwd: ROOT, encoding: "utf8" });
}

const slack = [];
for (const { file } of LIMIT_FILES) {
  const p = path.join(ROOT, file);
  const bak = backups.get(p);
  if (!bak) continue;
  const before = JSON.parse(readFileSync(bak, "utf8"));
  const after = JSON.parse(readFileSync(p, "utf8"));
  for (const [k, v] of Object.entries(before)) {
    if (typeof v !== "number") continue;
    const now = after[k];
    if (typeof now === "number" && now < v) {
      slack.push(`${file} の ${k}: 上限 ${v} ですが実測は ${now} です(差 ${v - now})`);
    }
  }
  // **必ず元に戻す。** 検査は読むだけ
  copyFileSync(bak, p);
  unlinkSync(bak);
}

if (slack.length === 0) {
  console.log(`✅ 上限にたるみはありません(${LIMIT_FILES.length} ファイルを検査)`);
  process.exit(0);
}
for (const s of slack) console.error(`❌ ${s}`);
console.error(`\n${slack.length} 件。**直したのに上限を下げ忘れています。**`);
console.error("その差分だけ後戻りが素通りし、検査は緑のままです。");
console.error("`node tools/debt.mjs --tighten` を流して、上限ファイルを commit してください。");
process.exit(1);
