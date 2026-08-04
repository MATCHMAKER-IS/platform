#!/usr/bin/env node
/**
 * **復元訓練を実際に走らせる。**
 *
 * 【なぜ要るか】
 * `check-drill` は「訓練していない」と警告し続け、`record-drill` は結果を記録する。
 * だが**訓練そのものは全部手作業**だった:
 * 空 DB を作り、`pg_restore` し、件数を数え、鍵を確かめ、時間を測り、記録する。
 *
 * 手順書は 126 行あり、所要は 1 時間とされていた。
 * その結果、**この基盤では一度も実施されていない**(2026-08 時点)。
 * 緊急性が無く、面倒で、失敗しても誰も困らない作業は、必ず後回しになる。
 *
 * 面倒さが原因なら、面倒さを消すのが正しい対処。
 * このツールは手順の機械的な部分を引き受け、**数分で終わる**ようにする。
 *
 * 【引き受けないこと】
 * - **本番への復元はしない。** 常に新しい空の DB に戻す(取り違え事故を防ぐ)
 * - **画面の確認は人がやる。** テーブルが戻っただけでは業務再開の証明にならない
 * - **詰まった箇所の記録も人が書く。** そこが訓練の主目的
 *
 * 【使い方】
 * ```bash
 * pnpm drill --dry                      # 何をするか見るだけ(DB 不要)
 * pnpm drill --from backup-20260801.dump
 * pnpm drill                            # ダンプの取得から通しでやる
 * ```
 *
 * 終わると `record-drill` に渡すコマンドを出力する。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

/** `--key value` を取り出す。 */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sourceUrl = arg("url") ?? process.env["DATABASE_URL"]
  ?? "postgresql://app:app@localhost:5432/app";

/** 復元先の DB 名。**毎回新しく作る**(既存に上書きしない)。 */
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const restoreDb = `restore_drill_${stamp}`;

/** 接続文字列の DB 名だけを差し替える。 */
function withDatabase(url, db) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

/** 管理用(postgres データベース)への接続。CREATE DATABASE に要る。 */
const adminUrl = withDatabase(sourceUrl, "postgres");
const restoreUrl = withDatabase(sourceUrl, restoreDb);

const steps = [];

/**
 * 1 手順を実行する。`--dry` なら表示するだけ。
 *
 * @param label 画面に出す名前
 * @param cmd 実行するコマンド
 * @param args 引数
 * @returns 標準出力(dry のときは空文字)
 * @throws 失敗した場合(**途中で止める**。半端な状態で先へ進まない)
 */
function run(label, cmd, args) {
  const shown = `${cmd} ${args.join(" ")}`;
  steps.push(shown);
  if (DRY) {
    console.log(`   ${label}\n     $ ${shown}`);
    return "";
  }
  process.stdout.write(`   ${label} … `);
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.error !== undefined || r.status !== 0) {
    console.log("失敗");
    console.error(`\n❌ ${label} で失敗しました`);
    console.error(`   $ ${shown}`);
    console.error(`   ${(r.stderr ?? r.error?.message ?? "").trim().slice(0, 800)}`);
    console.error("\n**これは訓練の成果です。** 本番の障害時に同じ場所で詰まっていました。");
    console.error("原因を docs/ops/BACKUP_RESTORE.md に書き足してから、もう一度流してください。");
    process.exit(1);
  }
  console.log("ok");
  return r.stdout;
}

/** psql で 1 行だけ返すクエリを流す。 */
function query(url, sql) {
  const r = spawnSync("psql", [url, "-tAc", sql], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

// **道具が無ければ、何をする前に言う。**
// 途中で `pg_restore: command not found` が出ると、
// 「バックアップが壊れている」のか「道具が無い」のか区別がつかない
const NEEDED = ["pg_dump", "pg_restore", "psql"];
// `--dry` は**何をするか見るためのもの**なので、道具が無くても通す。
// ここで止めると「手順を読むことすらできない」ことになる
const absent = DRY ? [] : NEEDED.filter((c) => spawnSync(c, ["--version"], { encoding: "utf8" }).status !== 0);
if (absent.length > 0) {
  console.error(`❌ 次のコマンドがありません: ${absent.join(", ")}`);
  console.error("   PostgreSQL のクライアントを入れてください。");
  console.error("   Docker で動かしているなら、コンテナの中から実行する手もあります:");
  console.error("     docker compose exec db pg_dump ...");
  console.error("   何をするかだけ見るなら: pnpm drill:dry");
  process.exit(1);
}

console.log("▶ 復元訓練");
console.log(`   復元元: ${sourceUrl.replace(/:[^:@]*@/, ":***@")}`);
console.log(`   復元先: ${restoreDb}(**新しい空の DB**。既存には触りません)`);
if (DRY) console.log("   （--dry のため実行しません）\n");
console.log("");

const started = Date.now();

// ── 1. ダンプを用意する ──
const dumpDir = path.join(ROOT, "ops", "drills", "dumps");
if (!DRY && !existsSync(dumpDir)) mkdirSync(dumpDir, { recursive: true });
let dump = arg("from");
if (dump === undefined) {
  dump = path.join(dumpDir, `drill-${stamp}.dump`);
  run("ダンプを取得", "pg_dump", [sourceUrl, "-Fc", "-f", dump]);
} else {
  if (!DRY && !existsSync(dump)) {
    console.error(`❌ ダンプが見つかりません: ${dump}`);
    process.exit(1);
  }
  console.log(`   既存のダンプを使う: ${dump}`);
}

// ── 2. 空の DB を作る ──
// **既存の DB に復元しない。** 取り違えは「よくある失敗」の筆頭
run("空の DB を作成", "psql", [adminUrl, "-c", `CREATE DATABASE ${restoreDb}`]);

// ── 3. 戻す ──
run("ダンプから復元", "pg_restore", ["-d", restoreUrl, "--no-owner", "--clean", "--if-exists", dump]);

// ── 4. 中身を確かめる ──
// テーブルが在るだけでは足りない。**元と件数が合うか**まで見る
if (!DRY) {
  const tables = query(restoreUrl,
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'");
  console.log(`   復元されたテーブル: ${tables} 件`);
  if (Number(tables) === 0) {
    console.error("❌ テーブルが 1 つもありません。ダンプが空か、復元先を間違えています");
    process.exit(1);
  }

  // 主要テーブルの件数を元と突き合わせる。**空のまま「成功」にしない**
  const names = query(restoreUrl,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' "
    + "ORDER BY table_name LIMIT 5").split("\n").filter(Boolean);
  let mismatch = 0;
  for (const t of names) {
    const before = query(sourceUrl, `SELECT count(*) FROM "${t}"`);
    const after = query(restoreUrl, `SELECT count(*) FROM "${t}"`);
    const same = before === after;
    if (!same) mismatch += 1;
    console.log(`     ${same ? "✅" : "❌"} ${t}: 元 ${before} / 復元 ${after}`);
  }
  if (mismatch > 0) {
    console.error("\n❌ 件数が一致しないテーブルがあります。ダンプの取得時点を確認してください");
    process.exit(1);
  }
}

// ── 5. 鍵を確かめる ──
// **典型的な失敗**: DB は戻せたが鍵が無く、暗号化した項目が読めない
const keyVars = ["ENCRYPTION_KEY", "SESSION_SECRET"];
const missing = keyVars.filter((k) => (process.env[k] ?? "") === "");
if (missing.length > 0) {
  console.log(`\n   ⚠ 秘密鍵が環境にありません: ${missing.join(", ")}`);
  console.log("     DB を戻せても、**暗号化した項目(マイナンバー等)は読めません**。");
  console.log("     鍵は DB と別の場所に保管し、訓練でも復号まで確かめてください。");
} else if (!DRY) {
  console.log("   秘密鍵は環境にあります(復号の実確認は画面側で)");
}

const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));

console.log("\n─────────────");
if (DRY) {
  console.log(`実行される手順は ${steps.length} 個です(--dry のため実行していません)。`);
  console.log("本番の DB には接続しません。復元先は毎回新しい DB です。");
  process.exit(0);
}

console.log(`✅ 復元できました(${minutes} 分)`);
console.log("");
console.log("**ここからは人がやること**:");
console.log(`  1. アプリを ${restoreDb} に向けて起動し、ログインして主要画面を 1 つ開く`);
console.log("     (テーブルが戻っただけでは、業務が再開できる証明になりません)");
console.log("  2. 暗号化した項目が読めるか確かめる");
console.log("  3. 詰まった箇所を docs/ops/BACKUP_RESTORE.md に書き足す");
console.log("  4. 記録する:");
console.log("");
console.log(`     node tools/record-drill.mjs \\`);
console.log(`       --minutes <画面確認まで含めた実測> \\`);
console.log(`       --from ${path.basename(dump)} \\`);
console.log(`       --operator "(実施者)" \\`);
console.log(`       --issue "(詰まったこと)" \\`);
console.log(`       --next "(直したこと)"`);
console.log("");
console.log(`  5. 後片付け: psql "${adminUrl.replace(/:[^:@]*@/, ":***@")}" -c 'DROP DATABASE ${restoreDb}'`);
