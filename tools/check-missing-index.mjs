/**
 * **`findMany` で絞る列に索引があるか**を見る。
 *
 * 【なぜ要るか】
 * **索引が無いと、全件を走査します。**
 * 数人の間はどのクエリも速いので、**遅くなるまで誰も気づけません**——
 * そして遅くなったときには、**動いているものを触る**ことになります。
 *
 * **`check-schema` は `@id` しか見ません**——索引は見ていません。
 *
 * 【この検査の限界】
 * **静的に見るだけ**です。**本当に効いているかは `EXPLAIN ANALYZE`** で確かめてください
 * （`docs/ops/LOAD_TESTING.md`）——**索引があっても使われないこと**があります
 * （型が違う、関数を通している、件数が少なくて全走査の方が速い）。
 *
 * **ここで見つかるのは「明らかに無い」もの**だけです。
 *
 * 【上限方式】
 * いまの数を上限とし、**増えたら落とします**。
 * **減らしたら `--set-limit` で上限も下げて**ください。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "missing-index-limit.json");

/**
 * **見るアプリ。**
 *
 * **手書きしません**——`apps/` から集めます。
 * **アプリが増えたときに、検査から漏れる**のを防ぐためです
 * （**漏れても緑になる**ので、気づけません）。
 */
const APPS = readdirSync(path.join(ROOT, "apps"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

/**
 * **絞り込みに使っても索引が要らない列。**
 *
 * **件数が少ない表**や、**必ず他の列と組で絞る**ものです。
 * **ここに足すときは理由を書いてください**——
 * **「面倒だから」で足すと、検査の意味がなくなります**。
 */
const NO_INDEX_NEEDED = new Set([
  // **主キーは索引が自動で作られます**
  "id",
  // **真偽値は絞り込みの効果が薄い**（半分に減るだけ）
  "active", "isActive", "enabled", "deleted", "archived",
]);

const problems = [];
let scanned = 0;

for (const app of APPS) {
  const schemaPath = path.join(ROOT, "apps", app, "prisma", "schema.prisma");
  const srcDir = path.join(ROOT, "apps", app, "src");
  if (!existsSync(schemaPath) || !existsSync(srcDir)) continue;

  const schema = readFileSync(schemaPath, "utf8");

  // **モデルごとに、索引の先頭列**を集めます。
  // **複合索引は先頭列でしか絞り込めない**ためです
  // （`[userId, date]` は `userId` だけの検索には効きますが、
  // **`date` だけの検索には効きません**）。
  const indexed = new Map();
  for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const cols = new Set();
    for (const i of m[2].matchAll(/@@index\(\[([^\]]+)\]/g)) {
      cols.add((i[1].split(",")[0] ?? "").trim());
    }
    for (const i of m[2].matchAll(/@@unique\(\[([^\]]+)\]/g)) {
      cols.add((i[1].split(",")[0] ?? "").trim());
    }
    for (const i of m[2].matchAll(/^\s+(\w+)[^\n]*@id/gm)) cols.add(i[1]);
    for (const i of m[2].matchAll(/^\s+(\w+)[^\n]*@unique/gm)) cols.add(i[1]);
    indexed.set(m[1], cols);
  }

  /** モデル名（`expenseRow` → `ExpenseRow`）。 */
  const toModel = (accessor) => accessor.charAt(0).toUpperCase() + accessor.slice(1);

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", "generated"].includes(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(entry.name) || entry.name.includes(".test.")) continue;

      const src = readFileSync(p, "utf8");
      scanned += 1;

      // **`db.xxxRow.findMany({ where: { 列名` の形**を拾います。
      // **入れ子の `where`（`AND` / `OR`）は見ません**——
      // **確実に分かるものだけ**を対象にするためです。
      for (const m of src.matchAll(/\.(\w+)\.findMany\(\{\s*(?:take:[^,]+,\s*)?where:\s*\{\s*(\w+)/g)) {
        const model = toModel(m[1]);
        const column = m[2];
        if (NO_INDEX_NEEDED.has(column)) continue;
        const cols = indexed.get(model);
        // **知らないモデル**は見ません（別のスキーマかもしれません）
        if (cols === undefined) continue;
        if (!cols.has(column)) {
          problems.push(`${path.relative(ROOT, p)}: ${model}.${column} に索引がありません`);
        }
      }
    }
  };
  walk(srcDir);
}

const readLimit = () => {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit;
  } catch {
    return problems.length;
  }
};

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({ limit: problems.length }, null, 2)}\n`);
  console.log(`✅ 上限を ${problems.length} に設定しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const p of problems) console.log(`   ${p}`);
  console.log(`   （${problems.length} 件）`);
  process.exit(0);
}

const limit = readLimit();

if (problems.length > limit) {
  console.error(`❌ 索引の無い絞り込みが ${problems.length} 件に増えました（上限 ${limit}）。`);
  console.error("   **索引が無いと全件を走査します**——数人の間は速く、100 人で急に遅くなります。");
  console.error("   一覧: node tools/check-missing-index.mjs --list");
  process.exit(1);
}

console.log(
  `✅ 索引の無い絞り込みは ${problems.length} 件です（上限 ${limit} / ${scanned} ファイルを検査）`,
);
console.log("   ※ **静的に見るだけ**です——本当に効いているかは `EXPLAIN ANALYZE` で確かめてください");
