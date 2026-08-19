#!/usr/bin/env node
/**
 * **パッケージ名の接頭辞（スコープ）を一括で改名する。**
 *
 * ```bash
 * node tools/rename-scope.mjs --dry     # 何が変わるか見るだけ（既定）
 * node tools/rename-scope.mjs --apply   # 実際に書き換える
 * ```
 *
 * 【なぜ要るか】
 * GitHub Packages は **スコープが Organization 名と一致していないと publish を弾きます**。
 * `@platform/*` のままでは配れないため、`@mtmk-cc/*` へ改名します（ADR-0026）。
 *
 * **これは一度きりの作業です。** 済んだらこのツールは消して構いません。
 *
 * 【変わらないもの】
 * - ローカルのフォルダ名（`platform/`）
 * - GitHub のリポジトリ名
 * - `packages/` の中の構成（`packages/ui/` はそのまま）
 *
 * 変わるのは **`package.json` の `name` と、ソース中の import 文だけ**です。
 *
 * 【なぜ機械でやるか】
 * 8,000 箇所以上あります。手で直すと**必ず取りこぼし**、
 * しかも取りこぼしは**ビルドが通ってしまう場所**（資料・コメント）に残ります。
 *
 * 【やったあとにすること】
 * 1. `pnpm install`（`workspace:` の解決先が変わるため）
 * 2. `pnpm check` と `pnpm build`
 * 3. **`pnpm-lock.yaml` をコミット**
 *
 * @packageDocumentation
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = "@platform/";
const TO = "@mtmk-cc/";
const apply = process.argv.includes("--apply");

/** 触らない場所。 */
const SKIP = new Set(["node_modules", ".git", ".next", "dist", ".turbo", "coverage"]);
/** 触る拡張子。**資料も直します**——古い名前が残ると、読んだ人がそのまま書きます。 */
const EXT = /\.(ts|tsx|mjs|mts|js|json|md|yml|yaml)$/;

/**
 * 再帰してファイルを集める。
 *
 * @param dir 起点
 * @param out 集めた先（再帰用）
 * @returns ファイルの絶対パス
 */
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

let files = 0;
let hits = 0;
const samples = [];

for (const f of collect(ROOT)) {
  const src = readFileSync(f, "utf8");
  if (!src.includes(FROM)) continue;
  const n = src.split(FROM).length - 1;
  files += 1;
  hits += n;
  if (samples.length < 5) samples.push(`${path.relative(ROOT, f).replace(/\\/g, "/")}（${n} 箇所）`);
  if (apply) writeFileSync(f, src.split(FROM).join(TO));
}

console.log(`${apply ? "✅ 改名しました" : "🔍 改名の対象（--dry）"}: ${files} ファイル / ${hits} 箇所`);
for (const s of samples) console.log(`   ${s}`);
if (files > 5) console.log(`   …ほか ${files - 5} ファイル`);

if (!apply) {
  console.log("\n   実際に書き換えるには --apply を付けてください。");
  console.log("   **戻すのは大変です**——先に commit して、作業用のブランチで走らせてください");
} else {
  console.log("\n   次にやること:");
  console.log("     pnpm install          # workspace の解決先が変わります");
  console.log("     pnpm check && pnpm build");
  console.log("     git add pnpm-lock.yaml && git commit");
}
