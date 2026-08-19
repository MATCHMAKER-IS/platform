#!/usr/bin/env node
/**
 * **まだ誰も検査していない重複の候補を洗い出す。**
 *
 * 【なぜ要るか】
 * `pnpm debt` が見せるのは**検査済みの残債**だけ。上限ファイルを持つ項目しか
 * 出てこないので、「まだ誰も検査していない重複」は表に現れない。
 *
 * 実際 2026-08 に、同じ 1 行
 * `req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1]` が
 * **249 か所**にコピーされ、**そのすべてが同じバグ**(部分一致するので
 * `zoho_session=...` があるとそちらの値を返す)を持っていた。
 * 型検査も lint も smoke も preflight も通っていて、残債表にも出ていなかった。
 * 見つかったのは偶然で、探し方が無かったのが問題。
 *
 * 【これは検査ではない】
 * **合否を出さない。** 重複には正当なものが多い
 * (`async function handleGET(req: Request)` は規約であって重複ではない)。
 * 機械が言えるのは「同じ行が何ファイルにあるか」までで、
 * **それが直すべき重複かは中身を見た人が決める**。
 * 合否を付けると、正当な重複を避けるための不自然な書き換えが始まる。
 *
 * 【最初に見つけたもの】
 * `const yen = (n: number) => ...` が 31 ファイルにあり、**中身が 6 種類**あった。
 * `¥1,234.56` / `¥1,235` / `¥1234.5600` / `1,234.56 円` …
 * **同じ金額が画面ごとに違う表示になっていた**(基盤の
 * `@platform/report` に `formatYen` がある)。
 *
 * 【件数の読み方に注意】
 * 「同じ行が N ファイル」の N は、**どこにあるか**まで教えてくれない。
 * `doFetch` の行を 94 ファイルと数えたとき、最初は「基盤が基盤自身を
 * 繰り返している」と読み違えた。実際は `packages/` に 4 件、
 * 残り 90 件は `apps/` のクライアント部品だった(意味がまるで違う)。
 * **必ず内訳を出してから判断すること**(`grep -rl ... | sed 's|^\(packages\|apps\)/\([^/]*\)/.*|\1/\2|' | sort | uniq -c`)。
 *
 * 実行:
 *   node tools/duplication.mjs           8 ファイル以上に出る同一行
 *   node tools/duplication.mjs --min 15  しきい値を変える
 *   node tools/duplication.mjs --name yen  ある名前の定義が何種類あるかを見る
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "generated"]);

const argMin = process.argv.indexOf("--min");
const MIN = argMin >= 0 ? Number(process.argv[argMin + 1]) : 8;
const argName = process.argv.indexOf("--name");
const NAME = argName >= 0 ? process.argv[argName + 1] : null;

function collect(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    // **テストは除く。** 同じ形の入力を並べるのが仕事で、重複して当然
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) acc.push(p);
  }
  return acc;
}

const files = [...collect(path.join(ROOT, "apps")), ...collect(path.join(ROOT, "packages"))]
  .filter((f) => !f.includes(".generated."));

// ── ある名前の定義が何種類あるかを見る ──
if (NAME !== null) {
  const defs = new Map();
  const re = new RegExp(`\\b(?:const|function)\\s+${NAME}\\b[^\\n]*`);
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.trim().match(re);
      if (!m) continue;
      const body = m[0].replace(/\s+/g, " ");
      if (!defs.has(body)) defs.set(body, []);
      defs.get(body).push(rel);
    }
  }
  const rows = [...defs].sort((a, b) => b[1].length - a[1].length);
  console.log(`▶ \`${NAME}\` の定義: ${rows.length} 種類 / ${rows.reduce((a, r) => a + r[1].length, 0)} か所\n`);
  for (const [body, where] of rows) {
    console.log(`  ${String(where.length).padStart(3)}  ${body.slice(0, 100)}`);
    console.log(`       例: ${where.slice(0, 2).join(", ")}`);
  }
  if (rows.length > 1) {
    console.log("\n**中身が違うものが同じ名前で存在します。**");
    console.log("読む人は同じ挙動だと思うので、画面ごとに結果が変わっていないか確かめてください。");
  }
  process.exit(0);
}

// ── 同一行の重複 ──
const map = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  for (const raw of readFileSync(f, "utf8").split("\n")) {
    const l = raw.trim();
    // **短い行・コメント・import は数えない。** 偶然の一致が多すぎて本物が埋もれる
    if (l.length < 45) continue;
    if (/^(\*|\/\/|\/\*|import |export \{|\})/.test(l)) continue;
    if (!/[(=]/.test(l)) continue;
    if (!map.has(l)) map.set(l, new Set());
    map.get(l).add(rel);
  }
}

const rows = [...map]
  .map(([line, set]) => ({ line, n: set.size, files: [...set] }))
  .filter((r) => r.n >= MIN)
  .sort((a, b) => b.n - a.n);

console.log(`▶ ${MIN} ファイル以上に現れる同一行: ${rows.length} 種\n`);
for (const r of rows.slice(0, 25)) {
  console.log(`  ${String(r.n).padStart(4)}  ${r.line.slice(0, 104)}`);
}
if (rows.length > 25) console.log(`  … ほか ${rows.length - 25} 種(--min を上げると絞れます)`);

console.log("\n**これは検査ではありません(合否を出しません)。**");
console.log("規約どおりの書き方が並んでいるだけのこともあります");
console.log("(`async function handleGET(req: Request)` など)。");
console.log("直すべき重複かは中身を見て決めてください。");
console.log("同じ名前で中身が違うものを探すなら: node tools/duplication.mjs --name yen");
