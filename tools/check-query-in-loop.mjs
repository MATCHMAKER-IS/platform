#!/usr/bin/env node
/**
 * **ループの中で DB を呼んでいないか**を見る(上限ラチェット)。
 *
 * ```bash
 * node tools/check-query-in-loop.mjs
 * node tools/check-query-in-loop.mjs --list
 * node tools/check-query-in-loop.mjs --set-limit
 * ```
 *
 * 【何が起きるか】
 *
 * ```ts
 * for (const d of docs) {
 *   await db.searchDocRow.upsert({ where: { id: d.id }, create: d, update: d });
 * }
 * ```
 *
 * **件数ぶんだけ DB と往復します。**
 * 1 往復 2ms でも、5 万件なら **100 秒**。ネットワーク越しならその数倍です。
 *
 * 2026-08、`reindex`(最大 5 万件)が実際にこの形でした。
 * **管理画面が固まったように見え、途中で閉じられると中途半端な索引が残ります**。
 *
 * 【なぜ静かに悪化するか】
 * **開発中のデータは 10 件**なので、体感は一瞬です。
 * 使われ始めて件数が増えたときに初めて遅くなり、
 * しかも「最近このシステム重い」としか報告されません。
 *
 * 【直し方】
 *
 * | 何をしていたか | 代わりに |
 * |---|---|
 * | ループで `create` | `createMany({ data })`（大量なら 1,000 件ずつに切る） |
 * | ループで `upsert` | まとめて `deleteMany` → `createMany`（作り直せるものなら） |
 * | ループで `findUnique` | `findMany({ where: { id: { in: ids } } })` で 1 回にして、Map に詰める |
 * | ループで `update`（値が違う） | **これは避けられないことがある**。件数の上限を決め、`// query-in-loop: <理由>` を書く |
 *
 * 【上限ラチェットにしている理由】
 * **「1 件ずつ」が正しい場面もあります**——行ごとに違う更新をする、
 * 1 件ずつトランザクションを分けたい、など。
 * **0 を目指すのではなく、増えたときに気づく**のが目的です。
 *
 * 実行: node tools/check-query-in-loop.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "query-in-loop-limit.json");

const list = process.argv.includes("--list");
const setLimit = process.argv.includes("--set-limit");

const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "generated", "coverage"]);

/** ループの始まり。 */
const LOOP = /\b(for|while)\s*\(|\.(map|forEach|filter|reduce)\(\s*async\b/;
/** DB の呼び出し。 */
const QUERY = /await\s+(?:db|tx|client|prisma)\.\w+\.(findMany|findUnique|findFirst|create|update|delete|upsert|count|aggregate)\b/;

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    // **`seed.ts` は対象外。** 初期データの投入は**手で 1 回叩くもの**で、
    // 利用者を待たせない。まとめ書きにすると「どの行で失敗したか」が
    // 分からなくなり、**投入の失敗を直しにくくなる**方が損。
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) && e.name !== "seed.ts") out.push(full);
  }
  return out;
}

const dirs = [path.join(ROOT, "apps"), path.join(ROOT, "packages")];
const files = dirs.flatMap((d) => collect(d));
const found = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");

  // **字下げでループの中かを見る。** 構文解析はしない——
  // 誤検出が多い検査は、そのうち誰も見なくなる。**深い入れ子だけを疑う**
  let loopIndent = null;
  let exempt = false;
  for (const [i, line] of lines.entries()) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const indent = (line.match(/^\s*/) ?? [""])[0].length;

    // ループを抜けた
    if (loopIndent !== null && line.trim() !== "" && indent <= loopIndent) { loopIndent = null; exempt = false; }

    if (LOOP.test(line) && /\{\s*$/.test(line)) {
      loopIndent = indent;
      // **注記はループ全体に効く。** ループの直前に 1 つ書けば、
      // 中の呼び出しすべてを認めたことになる——1 行ずつ書かせると、
      // **同じ理由が何度も並んで読みにくくなる**
      // ループの直前に**続いているコメントの塊**を遡って見る
      // (理由は複数行になるので、行数で切らない)
      exempt = false;
      for (let j = i - 1; j >= 0; j -= 1) {
        const prev = lines[j] ?? "";
        if (!/^\s*\/\//.test(prev)) break;
        if (/query-in-loop:\s*\S+/.test(prev)) { exempt = true; break; }
      }
      continue;
    }

    if (loopIndent === null) continue;
    if (!QUERY.test(line)) continue;
    if (exempt) continue;
    // 呼び出しの直前・同じ行に書いてもよい
    if (/\/\/\s*query-in-loop:\s*\S+/.test(line)
      || /\/\/\s*query-in-loop:\s*\S+/.test(lines[i - 1] ?? "")
      || /\/\/\s*query-in-loop:\s*\S+/.test(lines[i - 2] ?? "")) continue;
    found.push({ where: `${rel}:${i + 1}`, code: line.trim().slice(0, 70) });
  }
}

if (list) {
  console.log(`ループの中の DB 呼び出し(${found.length} 件 / ${files.length} ファイル):\n`);
  for (const f of found) console.log(`  ${f.where}\n      ${f.code}`);
  console.log("");
  console.log("直し方: createMany / findMany({ where: { id: { in: ids } } }) でまとめる");
  console.log("避けられないなら、その行に `// query-in-loop: <理由>` を書いてください");
  process.exit(0);
}

if (setLimit) {
  writeFileSync(
    LIMIT_FILE,
    `${JSON.stringify({
      note:
        "ループの中の DB 呼び出しの上限。**増やす方向に手で書き換えないこと。**"
        + "「1 件ずつ」が正しい場面もあるので 0 は目指さない——増えたときに気づくための上限。",
      max: found.length,
    }, null, 2)}\n`,
    "utf8",
  );
  console.log(`✅ 上限を刻みました: ${found.length} 件`);
  process.exit(0);
}

if (!existsSync(LIMIT_FILE)) {
  console.log(`⏭  check-query-in-loop は skip しました(上限が未設定。${found.length} 件)`);
  console.log("   `node tools/check-query-in-loop.mjs --set-limit` で刻んでください");
  process.exit(0);
}

const max = JSON.parse(readFileSync(LIMIT_FILE, "utf8")).max ?? 0;

if (found.length <= max) {
  console.log(`✅ ループ内の DB 呼び出しは上限内(${found.length} / 上限 ${max} / ${files.length} ファイル)`);
  process.exit(0);
}

console.error(`❌ ループの中の DB 呼び出しが増えました(${max} → ${found.length}):`);
for (const f of found.slice(0, 10)) console.error(`   ${f.where}: ${f.code}`);
if (found.length > 10) console.error(`   …ほか ${found.length - 10} 件(一覧は --list)`);
console.error("");
console.error("   **件数ぶんだけ DB と往復します。** 1 往復 2ms でも 5 万件で 100 秒。");
console.error("   **開発中のデータは 10 件なので体感は一瞬**——使われ始めてから遅くなります。");
console.error("");
console.error("   まとめる: createMany({ data }) / findMany({ where: { id: { in: ids } } })");
console.error("   避けられないなら: その行に `// query-in-loop: <理由>`");
process.exit(1);
