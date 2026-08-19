#!/usr/bin/env node
/**
 * **外部キーに索引が付いているか**を見る(上限ラチェット)。
 *
 * ```bash
 * node tools/check-db-indexes.mjs
 * node tools/check-db-indexes.mjs --list       # 索引の無い列の一覧
 * node tools/check-db-indexes.mjs --set-limit  # いまの数を上限に刻む
 * ```
 *
 * 【なぜ要るか】
 * **PostgreSQL は外部キーに索引を自動では作りません。**
 * 主キーと `@unique` には作られるので、「作られている」と思い込みやすいところです。
 *
 * 索引が無いと、こうなります:
 *
 * ```sql
 * SELECT * FROM chat_messages WHERE room_id = 'xxx';   -- 全件を読む
 * ```
 *
 * **10 件のときは速く、10 万件になると遅い。**
 * だから**開発中は気づけず、使われ始めてから急に遅くなります**——
 * しかも「最近このシステム重い」としか報告されません。
 *
 * さらに厄介なのが**削除**です。親の行を消すとき、PostgreSQL は
 * **子テーブルを全件走査して参照が無いかを確かめます**。
 * 索引が無ければ、**1 件の削除で全テーブルスキャン**が走ります。
 *
 * 【何を見るか】
 * `apps/<アプリ>/prisma/schema.prisma` の各モデルで、
 * **`@relation` の外部キー列**に `@@index` / `@@unique` / `@id` / `@unique` が
 * 無いものを数えます。
 *
 * 【なぜ 0 を目指さないか】
 * **索引はただではありません。** 書き込みが遅くなり、容量も食います。
 * 行数の少ないマスタ(部署・区分)に付けても意味がなく、むしろ損です。
 *
 * **上限ラチェット**にしてあるのは、**新しいモデルを足すときに
 * 「この列は引かれるか」を一度考える**ためです。
 * 考えた結果「要らない」なら、`// no-index: <理由>` を書いてください。
 *
 * 【日付の列は数えません】
 * `createdAt` などは「一覧を新しい順に出す」ときに効きますが、
 * **全部に付けるのは行き過ぎ**です。遅いと分かってから
 * `slowQueryLog`(`/admin/performance`)を見て足す方が確実です。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "db-index-limit.json");

const list = process.argv.includes("--list");
const setLimit = process.argv.includes("--set-limit");

/** schema から「索引の無い外部キー列」を集める。 */
function analyze(schemaPath) {
  const src = readFileSync(schemaPath, "utf8");
  const found = [];
  for (const [, name, body] of src.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    // **複合索引は先頭の列だけが単独検索に効く。** 2 番目以降は数えない
    const indexed = new Set();
    for (const [, cols] of body.matchAll(/@@(?:index|unique)\(\[([^\]]+)\]/g)) {
      const first = cols.split(",")[0]?.trim();
      if (first !== undefined) indexed.add(first.replace(/\(.*/, ""));
    }

    // **`@relation` は見ない。** このリポジトリは外部キーを**あえて張らず**、
    // `userId` などを**文字列として持つ**方針(schema.prisma の冒頭に理由がある)。
    // Prisma は `@relation` があるときしか索引を示唆しないので、
    // **この方針だと索引が 1 つも作られないまま気づけない**。
    // そこで「他のテーブルの ID を指していそうな列」を名前で拾う。
    for (const line of body.split("\n")) {
      const m = /^\s+(\w+)\s+(\S+)(.*)$/.exec(line);
      if (m === null) continue;
      const [, field, type, rest] = m;
      // **`id` そのものは主キー。** 指している側だけを見る
      if (field === "id") continue;
      if (!/[a-z]Id$/.test(field)) continue;
      // 関連や配列(スカラーでない)は対象外
      if (rest.includes("@relation") || type.endsWith("[]")) continue;
      // 単独で索引になっているもの
      if (rest.includes("@id") || rest.includes("@unique")) continue;
      if (indexed.has(field)) continue;
      // 明示的に不要と宣言したもの
      if (/\/\/\s*no-index:\s*\S+/.test(line)) continue;
      found.push({ model: name, field });
    }
  }
  return found;
}

const appsDir = path.join(ROOT, "apps");
const schemas = existsSync(appsDir)
  ? readdirSync(appsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => ({ app: e.name, path: path.join(appsDir, e.name, "prisma", "schema.prisma") }))
      .filter((s) => existsSync(s.path))
  : [];

if (schemas.length === 0) {
  console.log("⏭  check-db-indexes は skip しました(schema.prisma がありません)");
  process.exit(0);
}

const all = [];
for (const s of schemas) {
  for (const f of analyze(s.path)) all.push({ app: s.app, ...f });
}

if (list) {
  console.log(`索引の無い外部キー(${all.length} 件 / ${schemas.length} スキーマ):\n`);
  let current = "";
  for (const f of all) {
    if (f.model !== current) { console.log(`  ${f.app} / ${f.model}`); current = f.model; }
    console.log(`      ${f.field}`);
  }
  console.log("");
  console.log("付けるなら schema.prisma のモデル末尾に:");
  console.log("  @@index([roomId])");
  console.log("");
  console.log("**全部に付ける必要はありません。** 行数の少ないマスタには不要です。");
  console.log("要らないと判断したら、その列の行末に `// no-index: <理由>` を書いてください。");
  process.exit(0);
}

if (setLimit) {
  writeFileSync(
    LIMIT_FILE,
    `${JSON.stringify({
      note:
        "索引の無い外部キーの上限。**増やす方向に手で書き換えないこと。**"
        + "新しいモデルを足すときに「この列は引かれるか」を一度考えるための上限。"
        + "要らないと判断したら `// no-index: <理由>` を書く。",
      max: all.length,
    }, null, 2)}\n`,
    "utf8",
  );
  console.log(`✅ 上限を刻みました: ${all.length} 件`);
  process.exit(0);
}

if (!existsSync(LIMIT_FILE)) {
  console.log(`⏭  check-db-indexes は skip しました(上限が未設定。索引の無い外部キー ${all.length} 件)`);
  console.log("   `node tools/check-db-indexes.mjs --set-limit` で刻んでください");
  process.exit(0);
}

const max = JSON.parse(readFileSync(LIMIT_FILE, "utf8")).max ?? 0;

if (all.length <= max) {
  console.log(`✅ 索引の無い外部キーは上限内(${all.length} / 上限 ${max} / ${schemas.length} スキーマ)`);
  process.exit(0);
}

console.error(`❌ 索引の無い外部キーが増えました(${max} → ${all.length}):`);
for (const f of all.slice(0, 10)) console.error(`   ${f.app} / ${f.model}.${f.field}`);
if (all.length > 10) console.error(`   …ほか ${all.length - 10} 件(一覧は --list)`);
console.error("");
console.error("   **PostgreSQL は外部キーに索引を自動では作りません。**");
console.error("   無いと、その列で絞る検索が全件走査になります——");
console.error("   **10 件のときは速く、10 万件で急に遅くなります**(開発中は気づけない)。");
console.error("   親の行を削除するときも、子テーブルを全件走査します。");
console.error("");
console.error("   付けるなら:  @@index([roomId])");
console.error("   要らないなら: その列の行末に `// no-index: <理由>`");
process.exit(1);
