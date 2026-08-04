#!/usr/bin/env node
/**
 * 公開 API サーフェスのスナップショット検査(オフライン)。
 *  - 各パッケージの **package.json `exports` に載っている入口すべて**から
 *    export 名を収集し、スナップショットと比較。
 *  - export の「削除・リネーム」を破壊的変更として検出(追加は許容=警告)。
 * 使い方:
 *   node tools/api-surface.mjs          … スナップショットと比較(CI 用。差分あれば exit 1)
 *   node tools/api-surface.mjs --update … スナップショットを再生成
 *
 * 【なぜ index.ts だけでは足りないか】
 * `@platform/db/tunnel` のように **バレルから再 export しない**サブパスがある。
 * ブラウザから使う部分を切り出す(`@platform/fs/magic`)、node 依存を
 * 引き込ませない(`@platform/db/tunnel`)といった理由で、これは意図的な設計。
 *
 * だが index.ts だけを見ていたため、**サブパスの公開 API は記録されず**、
 * 削除しても検知されず、module-list.md にも出ないので**誰も存在に気づけない**
 * 状態だった(2026-08 時点で 13 パッケージ・4 件は追加直後で未記載)。
 * 入口は package.json の `exports` が正解を持っているので、そこから辿る。
 *
 * 【記録の形と、その限界】
 * キーは**パッケージ名 1 つ**にして、サブパスの export も同じ配列へ統合する。
 * `surface["@platform/db"]` で引く利用側(module-list・advisor・portal 等)を
 * そのまま動かすため。
 *
 * この形だと、**同じ名前が入口を移った場合は検出できない**
 * (バレル → サブパスへの移動は利用側にとって破壊的だが、名前は残るため)。
 * 入口ごとに記録すれば検出できるが、キーが「パッケージ名」でなくなり
 * 利用側 6 箇所の書き換えが要る。**入口の移動は稀**なので、
 * 名前の削除を確実に捉える方を採った。
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectPackageSurface } from "./lib/package-surface.mjs";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "docs/platform/api-surface.json");

function collectAll() {
  const surface = {};
  const base = join(ROOT, "packages");
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(base, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
    const s = collectPackageSurface(join(base, entry.name), pkgJson);
    // 記録するのは名前だけ。complete(数え切れたか)は check-imports が使う
    if (s) surface[pkgJson.name] = s.names;
  }
  return surface;
}

const current = collectAll();
const update = process.argv.includes("--update");

if (update || !existsSync(SNAPSHOT)) {
  writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + "\n");
  console.log(`✅ API サーフェスを保存: ${Object.keys(current).length} パッケージ`);
  process.exit(0);
}

const prev = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
let breaking = 0, added = 0;
for (const [pkg, prevExports] of Object.entries(prev)) {
  const now = new Set(current[pkg] ?? []);
  const removed = prevExports.filter((e) => !now.has(e));
  if (!current[pkg]) { console.error(`❌ パッケージ削除: ${pkg}`); breaking++; continue; }
  if (removed.length > 0) { console.error(`❌ ${pkg}: export 削除 → ${removed.join(", ")}`); breaking += removed.length; }
}
for (const [pkg, nowExports] of Object.entries(current)) {
  const before = new Set(prev[pkg] ?? []);
  const news = nowExports.filter((e) => !before.has(e));
  if (news.length > 0) { console.log(`➕ ${pkg}: 追加 ${news.join(", ")}`); added += news.length; }
}

console.log(`\n追加 ${added} 件 / 破壊的変更 ${breaking} 件`);
if (breaking > 0) { console.error("❌ 公開 API に破壊的変更があります(意図的なら --update で更新)"); process.exit(1); }
console.log("✅ 公開 API に破壊的変更なし");
