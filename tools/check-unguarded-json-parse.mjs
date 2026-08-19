/**
 * **`JSON.parse` が守られていない箇所**を検出する。
 *
 * 【なぜ見張るか】
 * `JSON.parse` は**不正な入力で必ず例外を投げる**。外部から来る文字列
 * (Webhook・API 応答・Redis の値・アップロードされたファイル)で呼ぶと、
 * **経路が 500 を返す**。相手が Webhook の送信元なら、
 * **同じボディを何度も送り直してくる**——壊れたものは何度送っても壊れているので、
 * リトライが止まらない。
 *
 * 2026-08 に実際、次の 3 箇所が守られていなかった:
 *
 * - `parseFreeeWebhook` … **説明には「解析できなければ空配列」と書いてあった**
 * - `cache.get` … `tryCatch` が取得だけを守り、パースは外にあった
 * - 冪等キーの記録 … **二重実行を防ぐ仕組みが、実行を止める側に回っていた**
 *
 * 【判定の方法】
 * **前後の行に `try {` があるか**を見る粗い判定。構文解析はしない
 * (それを正しくやるには TypeScript のコンパイラが要る)。
 * 見落としも誤検出もあるが、**外部入力を扱う箇所を見つける**には十分。
 *
 * 【なぜ上限方式か】
 * 設定ファイルの読み込みなど、**落ちてよい場所もある**(起動時に気づける方がよい)。
 * 一律に禁じるとかえって不自然な書き方を強いるので、
 * **増やさないことだけ**を守る。
 *
 * 使い方:
 * ```
 * node tools/check-unguarded-json-parse.mjs           # 上限を超えたら失敗
 * node tools/check-unguarded-json-parse.mjs --list    # 全件出す
 * node tools/check-unguarded-json-parse.mjs --set-limit  # 上限を今の数に下げる
 * ```
 *
 * @packageDocumentation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lib/collect-files.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_FILE = path.join(ROOT, "tools", "unguarded-json-parse-limit.json");

/** 上限を読む。 */
function readLimit() {
  try {
    const j = JSON.parse(fs.readFileSync(LIMIT_FILE, "utf8"));
    return typeof j.limit === "number" ? j.limit : 0;
  } catch {
    return 0;
  }
}

/**
 * **意図的に守っていない箇所**。
 *
 * 落ちてよい・落ちた方がよい場所を明示する。ここに載せるときは
 * **なぜ落ちてよいか**を書くこと。
 */
const ALLOWED = [
  // 設定ファイル。**起動時に落ちる方がよい**(既定値で動くと、設定が
  // 読めていないことに気づけない)
  "packages/fs/src/operations.ts",
  // 自分が書いた値を読み戻すだけ(DB の JSON 列・埋め込みベクトル)。
  // **壊れていたらデータの破損**なので、黙って続けない
  "packages/db/src/raw.ts",
  "packages/rag/src/index.ts",
];

/** 守られていない `JSON.parse` を探す。 */
function findUnguarded() {
  const hits = [];
  for (const rel of collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx"] })) {
    if (/\.test\.tsx?$/.test(rel)) continue;
    // **showcase は基盤の見本**(模擬 fetch・生成物)なので対象外。
    // 外部からの入力を受けないうえ、**壊れた入力を見せる例**もある
    if (rel.replace(/\\/g, "/").startsWith("apps/showcase/")) continue;
    // **設定ファイルの読み込みは落ちてよい**——起動時に気づける方がよく、
    // 既定値で先に進むと**設定が読めていないまま動く**
    if (ALLOWED.some((a) => rel.replace(/\\/g, "/").endsWith(a))) continue;
    const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!/JSON\.parse\(/.test(line)) continue;
      // **コメント行は対象外**(説明で言及しているだけ)
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      // **前後に `try {` があれば守られているとみなす**(粗い判定)
      const around = lines.slice(Math.max(0, i - 12), i + 3).join("\n");
      if (/\btry\s*\{/.test(around)) continue;
      hits.push({ file: rel.replace(/\\/g, "/"), line: i + 1, text: line.trim().slice(0, 80) });
    }
  }
  return hits;
}

const hits = findUnguarded();
const limit = readLimit();

if (process.argv.includes("--set-limit")) {
  fs.writeFileSync(
    LIMIT_FILE,
    `${JSON.stringify({
      _comment: "try/catch で守られていない JSON.parse の上限。増やさないための歯止め。減らしたら --set-limit で下げる。",
      limit: hits.length,
    }, null, 2)}\n`,
  );
  console.log(`✅ 上限を更新しました(${hits.length} 件)`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const h of hits) console.log(`   ${h.file}:${h.line}  ${h.text}`);
}

if (hits.length > limit) {
  console.error(`❌ 守られていない JSON.parse が ${hits.length} 件に増えました(上限 ${limit})`);
  for (const h of hits.slice(0, 10)) console.error(`   ${h.file}:${h.line}  ${h.text}`);
  console.error("");
  console.error("**外部から来る文字列なら必ず守ること。** 壊れたボディで 500 を返すと、");
  console.error("Webhook の送信元が**同じものを何度も送り直します**(止まりません)。");
  console.error("`@platform/json` の `safeParse` を使うか、try/catch で囲んでください。");
  process.exit(1);
}

// **走査量を出す。** 出さないと「**何も見ていないのに緑**」に気づけない
const scannedCount = collectFiles(["packages", "apps"], ROOT, { extensions: [".ts", ".tsx"] }).length;
console.log(`✅ 守られていない JSON.parse は上限内です(${scannedCount} ファイルを検査 / ${hits.length} 件 / 上限 ${limit})`);
