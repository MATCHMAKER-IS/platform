/**
 * **同じ名前の実装が 2 つあるとき、引数の数が食い違っていないか**を見る。
 *
 * 【なぜ要るか】
 * リポジトリは**Prisma 実装とメモリ実装の 2 つ**を持っています
 * （本番用と試験用）。**片方だけ直すと、試験では通るのに本番で落ちます**
 * ——**逆もあり、どちらも気づきにくい**失敗です。
 *
 * **2026-08 に 3 回踏みました**（`toApproval` の引数を増やしたとき）。
 *
 * 【型検査があるのに、なぜ】
 * **`pnpm typecheck` なら 1 回で分かります。**
 * ただし**依存が入っていない環境**では回せません——
 * AI（Claude）が作業するときは**そういう環境**のことがあります。
 *
 * **この検査は型検査の代わりではありません**——
 * **回せないときの保険**です。**回せるなら `pnpm typecheck` を使ってください**。
 *
 * 【見るもの】
 * **同じファイル内で、同じ名前の `async` メソッドが 2 つ**あるとき、
 * **引数の数**を比べます。
 *
 * **中身は見ません**——名前が同じでも**別の役割**のことがあり、
 * 引数の数だけが**確実に食い違いを示す**からです。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 見るところ。 */
const TARGETS = ["apps/internal-app/src/server", "apps/line-console/src/server"];

const problems = [];
let checked = 0;

for (const dir of TARGETS) {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) continue;

  for (const file of readdirSync(full)) {
    // **`.tsx` も見ます。** 2 実装（メモリ / Prisma）を持つのは
    // **いまはサーバ側のリポジトリだけ**ですが、**将来どこに書かれるか分かりません**
    // ——**当たらないだけで害はない**ので、広く見ておきます。
    if (!/\.tsx?$/.test(file) || file.includes(".test.")) continue;
    const src = readFileSync(path.join(full, file), "utf8");
    checked += 1;

    // **`export function createXxx` ごとに区切ります。**
    // 1 つのファイルに**複数の器**があることがあり
    // （スケジュールと実行履歴、など）、**まとめて見ると誤検出**します
    // ——実際、`export-schedule.ts` で 2 件誤って出ました（2026-08）。
    const blocks = [];
    const starts = [...src.matchAll(/^export function (create\w+)/gm)];
    for (let i = 0; i < starts.length; i += 1) {
      const from = starts[i].index ?? 0;
      const to = i + 1 < starts.length ? (starts[i + 1].index ?? src.length) : src.length;
      blocks.push({ name: starts[i][1], body: src.slice(from, to) });
    }
    // **`createMemoryXxx` と `createPrismaXxx` の組**だけを比べます。
    //
    // **同じ役割の 2 実装**（試験用と本番用）なので、
    // **引数が食い違ってはいけません**。
    //
    // **同じ器の中で比べても意味がありません**——
    // メソッドは 1 つずつしかないためです。**別の器どうしを比べます**。
    const memory = blocks.filter((b) => b.name.includes("Memory"));
    for (const mem of memory) {
      const pairName = mem.name.replace("Memory", "Prisma");
      const prisma = blocks.find((b) => b.name === pairName);
      // **片方しか無いこともあります**（メモリ実装だけ、など）——
      // それは**設計の選択**なので、ここでは何も言いません。
      if (prisma === undefined) continue;
      comparePair(mem, prisma, `${dir}/${file}`);
    }
  }
}

/**
 * **2 つの器（メモリ / Prisma）で、同じ名前のメソッドの引数を比べる。**
 *
 * **中身は見ません**——**引数の数だけが、確実に食い違いを示す**からです。
 */
function comparePair(mem, prisma, where) {
  const argsOf = (src) => {
    const out = new Map();
    // **`([^)]*)` を使わない。** **既定値に `)` があると途中で切れます**
      // ——`f(a = new Date())` の `)` で終わってしまい、**引数の数を取り違えます**。
      // **`)` の後に `{` か `:` が来るところ**で区切ります——
      // **1 行で書かれたメソッド**（`async f(a) { return a; },`）にも当たります。
      for (const m of src.matchAll(/^ {4}async (\w+)\((.*?)\)\s*[:{]/gm)) {
      const args = m[2].trim();
      out.set(m[1], args === "" ? 0 : args.split(",").length);
    }
    return out;
  };
  const a = argsOf(mem.body);
  const b = argsOf(prisma.body);
  for (const [name, countA] of a) {
    const countB = b.get(name);
    // **片方にしか無いメソッド**は見ません（役割が違うことがあります）
    if (countB === undefined) continue;
    if (countA !== countB) {
      problems.push(
        `${where}: ${name}(メモリ ${countA} / Prisma ${countB})`,
      );
    }
  }
}

/** 使わなくなった関数（残しておくと誤解を招くので消しました）。 */
function unusedCheckBlock(src, where, blockName) {
    /** メソッド名 → 引数の数の一覧。 */
    const byName = new Map();

    // **`    async 名前(引数) {` の形だけ**を見ます。
    // インデント 4 は**返すオブジェクトの中のメソッド**——
    // トップレベルの関数を拾わないためです。
    // **`([^)]*)` を使わない。** **既定値に `)` があると途中で切れます**
      // ——`f(a = new Date())` の `)` で終わってしまい、**引数の数を取り違えます**。
      // **`)` の後に `{` か `:` が来るところ**で区切ります——
      // **1 行で書かれたメソッド**（`async f(a) { return a; },`）にも当たります。
      for (const m of src.matchAll(/^ {4}async (\w+)\((.*?)\)\s*[:{]/gm)) {
      const name = m[1];
      const args = m[2].trim();
      // **引数の数を数えます。** 空なら 0
      const count = args === "" ? 0 : args.split(",").length;
      const list = byName.get(name) ?? [];
      list.push(count);
      byName.set(name, list);
    }

    for (const [name, counts] of byName) {
      if (counts.length < 2) continue;
      const unique = [...new Set(counts)];
      if (unique.length > 1) {
        problems.push(`${where} の ${blockName}: ${name}(引数の数が ${counts.join(" と ")})`);
      }
    }
}

if (problems.length > 0) {
  console.error("❌ 同じ名前の実装で、引数の数が食い違っています:");
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  console.error("   **片方だけ直すと、試験では通るのに本番で落ちます**（逆もあります）。");
  console.error("   両方を同じ形にしてください。");
  process.exit(1);
}

console.log(
  `✅ 2 実装（Prisma / メモリ）の引数が揃っています（${checked} ファイル検査）`,
);
console.log("   ※ 型検査の代わりではありません——回せるなら `pnpm typecheck` を使ってください");
