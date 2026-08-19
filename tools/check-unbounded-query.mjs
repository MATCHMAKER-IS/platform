/**
 * **上限（`take`）の無い一覧**を見張る。
 *
 * 【なぜ要るか】
 * `findMany` に `take` が無いと、**その表の全件を読みます**。
 * 数人で使っている間は速いので、**遅くなるまで誰も気づけません**——
 * そして遅くなったときには、**動いているものを触る**ことになります。
 *
 * **100 人が毎日使えば、1 年で経費 3 万件・通知 18 万件**です。
 *
 * 【全部に付ければよいわけではありません】
 * **増えない表には要りません**:
 *
 * | 表 | 件数 | `take` |
 * |---|---|---|
 * | 勘定科目、部署、役職 | **数十で止まる** | 不要 |
 * | 経費、勤怠、通知、監査ログ | **増え続ける** | **必須** |
 * | チャットの部屋、リアクション | 1 対象あたり数十 | 不要 |
 *
 * **「増え続けるか」で決めてください。**
 * 迷ったら**付ける**方が安全です——付けすぎても、
 * 「一覧が途中で切れる」で済みます。
 *
 * 【上限方式です】
 * いまの数を上限とし、**増えたら落とします**。
 * 減らしたら `--set-limit` で上限も下げてください
 * ——下げないと**また増やせてしまいます**。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "unbounded-query-limit.json");

/** 走査するところ。 */
const TARGET_DIRS = ["apps", "packages"];

/**
 * **増え続ける表の名前**（この語を含むものは特に危ない）。
 *
 * ここに載っているのに `take` が無ければ、**一覧に出して知らせます**
 * ——上限には数えますが、**優先して直すべきもの**が分かるようにするためです。
 */
/**
 * **確認済みで `take` が要らないもの。**
 *
 * 「増え続ける表」に見えても、**1 回の呼び出しで返る件数が限られる**なら不要です。
 * 2026-08 に 1 件ずつ確認しました:
 *
 * | 場所 | なぜ要らないか |
 * |---|---|
 * | `attendance-repo`（月単位） | **1 か月は最大 31 件**です |
 * | `chat-reactions`（3 箇所） | **1 メッセージあたりのリアクション**——多くて数十 |
 * | `chat-rooms` | **その人が入っている部屋**——100 人規模なら数十 |
 *
 * **「増え続けるか」ではなく「1 回で何件返るか」で判断してください。**
 * 表が 100 万行あっても、**絞って 20 件しか返らないなら問題ありません**。
 */
const GROWING = [
  "expense", "attendance", "audit", "notification", "chat", "message",
  "log", "history", "invoice", "journal", "movement", "approval",
];

/** 見つかった箇所。 */
const hits = [];

/** 走査する。 */
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "generated", "dist"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\./.test(entry.name)) continue;

    const src = readFileSync(p, "utf8");
    // **`findMany({ ... })` を拾う。** 400 文字までで打ち切るのは、
    // **入れ子が深いと関数の外まで拾ってしまう**ため。
    // 長い呼び出しは見逃しますが、**そこは目視で足りる**と判断しています。
    // **上限の理由**: `findMany({ ... })` の中身の長さ。
    // **入れ子が深いと関数の外まで拾ってしまう**ので打ち切っています。
    // 長い呼び出しは見逃しますが、**そこは目視で足りる**と判断しました。
    for (const m of src.matchAll(/(\w+)\.findMany\(\{[\s\S]{0,400}?\}\)/g)) {
      // **`take` の短縮記法も認める。** `{ where, orderBy, take }` のように
      // 変数名をそのまま書く形(ES2015 のプロパティ短縮)は `take:` にならない。
      // `take:` だけを探すと、**上限を渡しているのに「無い」と数え**、
      // 率が実態より悪く出る(2026-08、`notification-center` が実際にそうだった)。
      if (/\btake\s*[:,}]/.test(m[0])) continue;
      const model = m[1];
      const rel = path.relative(ROOT, p);
      // **絞り込みがあれば「増え続ける」に数えない。**
      // `where: { messageId }` は**メッセージ 1 件あたり**、
      // `where: { id: { in: ids } }` は**その人が入っている部屋だけ**なので、
      // 表そのものが増えても 1 回の結果は増えない。
      // **ここを見ないと、正しい絞り込みまで「危ない」と印を付ける**ことになり、
      // 本当に危ないものが埋もれる(2026-08)。
      const narrowed = /where:\s*\{[^}]*\b(id|Id|userId|messageId|roomId|sku|key|code)\b/.test(m[0]);
      const growing = !narrowed && GROWING.some((g) => model.toLowerCase().includes(g));
      hits.push({ rel, model, growing });
    }
  }
}

for (const dir of TARGET_DIRS) {
  try {
    walk(path.join(ROOT, dir));
  } catch {
    // **そのフォルダが無くても止めない**（`apps/` は git 管理外です）
  }
}

const readLimit = () => {
  try {
    return JSON.parse(readFileSync(LIMIT_FILE, "utf8")).limit;
  } catch {
    return hits.length;
  }
};

if (process.argv.includes("--set-limit")) {
  writeFileSync(LIMIT_FILE, `${JSON.stringify({ limit: hits.length }, null, 2)}\n`);
  console.log(`✅ 上限を ${hits.length} に設定しました`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const h of hits) {
    console.log(`   ${h.growing ? "⚠" : " "} ${h.rel}: ${h.model}`);
  }
  process.exit(0);
}

const limit = readLimit();
const growing = hits.filter((h) => h.growing);

if (hits.length > limit) {
  console.error(`❌ 上限(take)の無い一覧が ${hits.length} 件に増えました(上限 ${limit})。`);
  console.error("   `take` を付けるか、増えない表なら上限を上げてください。");
  console.error("   一覧: node tools/check-unbounded-query.mjs --list");
  process.exit(1);
}

console.log(
  `✅ 上限(take)の無い一覧は ${hits.length} 件です(上限 ${limit} / `
  + `うち増え続ける表は ${growing.length} 件 / ${TARGET_DIRS.join(",")} を走査)`,
);
if (growing.length > 0) {
  console.log("   ⚠ 増え続ける表で take が無いもの:");
  for (const h of growing.slice(0, 5)) console.log(`      ${h.rel}: ${h.model}`);
}
