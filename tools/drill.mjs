#!/usr/bin/env node
/**
 * **復元訓練を実際に走らせる。**
 *
 * 【なぜ要るか】
 * `check-drill` は「訓練していない」と警告し続け、`record-drill` は結果を記録する。
 * だが**訓練そのものは全部手作業**だった:
 * 空 DB を作り、`pg_restore` し、件数を数え、鍵を確かめ、時間を測り、記録する。
 * 手順書は 126 行あり、所要は 1 時間。緊急性が無く、面倒で、失敗しても
 * 誰も困らない作業は必ず後回しになる。面倒さが原因なら、面倒さを消すのが正しい対処。
 *
 * 【2 つのモード】
 * - **docker**(既定・自動判定): `docker compose exec db` 経由。**ホストに
 *   PostgreSQL クライアントが要らない。** ダンプはコンテナ内で作り、
 *   `docker compose cp` でホストへ取り出す。
 * - **local**: ホストの `pg_dump` / `pg_restore` / `psql` を直接使う。
 *
 * 最初は local だけで作ったが、**Windows には PostgreSQL クライアントが入っておらず
 * 実行できなかった**(2026-08)。この基盤は DB を Docker で動かすので、
 * 道具もコンテナの中にある。そちらを既定にするのが素直だった。
 *
 * 【引き受けないこと】
 * - **本番への復元はしない。** 常に新しい空の DB に戻す(取り違え事故を防ぐ)
 * - **画面の確認は人がやる。** テーブルが戻っただけでは業務再開の証明にならない
 * - **詰まった箇所の記録も人が書く。** そこが訓練の主目的
 *
 * 【使い方】
 * ```bash
 * pnpm drill:dry                # 何をするか見るだけ(DB 不要)
 * pnpm drill                    # 実行(自動でモードを選ぶ)
 * pnpm drill -- --mode local    # ホストの pg_dump を使う
 * ```
 */
import { spawnSync } from "node:child_process";
import { createDecipheriv, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

/** `--key value` を取り出す。 */
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** コマンドが使えるか。 */
function has(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.error === undefined && r.status === 0;
}

/**
 * どちらのモードで走らせるか決める。
 *
 * **ホストに `pg_dump` があってもコンテナを優先はしない**(明示指定を尊重する)。
 * 自動判定は「ホストに無ければコンテナ」という順。
 */
function resolveMode() {
  const explicit = arg("mode");
  if (explicit === "local" || explicit === "docker") return explicit;
  if (DRY) return has("pg_dump") ? "local" : "docker";
  if (has("pg_dump") && has("pg_restore") && has("psql")) return "local";
  return "docker";
}

const MODE = resolveMode();
const DB_SERVICE = arg("service") ?? "db";
const DB_USER = arg("user") ?? "app";
const SOURCE_DB = arg("db") ?? "app";

const sourceUrl = arg("url") ?? process.env["DATABASE_URL"]
  ?? `postgresql://${DB_USER}:${DB_USER}@localhost:5432/${SOURCE_DB}`;

/** 復元先の DB 名。**毎回新しく作る**(既存に上書きしない)。 */
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const restoreDb = `restore_drill_${stamp}`;

/** 接続文字列の DB 名だけを差し替える。 */
function withDatabase(url, db) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

/** パスワードを伏せる(ログ・画面共有に残るため)。 */
const mask = (s) => s.replace(/:[^:@/]*@/, ":***@");

// **所要時間を測る。** 記録に手で書かせると、だいたい概算になる
const startedAt = Date.now();

const steps = [];

/**
 * 1 手順を実行する。`--dry` なら表示するだけ。
 *
 * @param label 画面に出す名前
 * @param cmd 実行するコマンド
 * @param args 引数
 * @returns 標準出力(dry のときは空文字)
 */
function run(label, cmd, args) {
  const shown = mask(`${cmd} ${args.join(" ")}`);
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

/** コンテナ内で 1 行だけ返すクエリを流す。 */
function query(db, sql) {
  const args = MODE === "docker"
    ? ["compose", "exec", "-T", DB_SERVICE, "psql", "-U", DB_USER, "-d", db, "-tAc", sql]
    : [withDatabase(sourceUrl, db), "-tAc", sql];
  const r = spawnSync(MODE === "docker" ? "docker" : "psql", args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

// **道具が無ければ、何をする前に言う。**
// 途中で `command not found` が出ると、「バックアップが壊れている」のか
// 「道具が無い」のか区別がつかない。
if (!DRY) {
  if (MODE === "local") {
    const absent = ["pg_dump", "pg_restore", "psql"].filter((c) => !has(c));
    if (absent.length > 0) {
      console.error(`❌ 次のコマンドがありません: ${absent.join(", ")}`);
      console.error("   PostgreSQL のクライアントを入れるか、`pnpm drill -- --mode docker` を使ってください。");
      process.exit(1);
    }
  } else if (!has("docker", ["version"])) {
    console.error("❌ docker が使えません。Docker Desktop を起動してください。");
    console.error("   ホストに PostgreSQL クライアントがあるなら `pnpm drill -- --mode local` も使えます。");
    process.exit(1);
  }
}

console.log("▶ 復元訓練");
console.log(`   方式  : ${MODE === "docker" ? "docker compose exec(ホストに PostgreSQL クライアント不要)" : "ホストの pg_dump / pg_restore"}`);
console.log(`   復元元: ${MODE === "docker" ? `${DB_SERVICE} コンテナのデータベース ${SOURCE_DB}` : mask(sourceUrl)}`);
console.log(`   復元先: ${restoreDb}(**新しい空の DB**。既存には触りません)`);
if (DRY) console.log("   （--dry のため実行しません）");
console.log("");

const started = Date.now();

const dumpDir = path.join(ROOT, "ops", "drills", "dumps");
if (!DRY && !existsSync(dumpDir)) mkdirSync(dumpDir, { recursive: true });
const dumpName = `drill-${stamp}.dump`;
const hostDump = path.join(dumpDir, dumpName);
/** コンテナ内のダンプ置き場。**ホストとの間で標準入出力を使わない**
 *  (Windows のバイナリパイプは壊れやすい)。 */
const containerDump = `/tmp/${dumpName}`;

const fromArg = arg("from");

if (MODE === "docker") {
  // ── 1. ダンプを取る(コンテナ内) ──
  if (fromArg === undefined) {
    run("ダンプを取得(コンテナ内)", "docker",
      ["compose", "exec", "-T", DB_SERVICE, "pg_dump", "-U", DB_USER, "-Fc", "-f", containerDump, SOURCE_DB]);
    // **ホストへ取り出せることも確かめる。**
    // コンテナが消えたら失われるので、外に出せなければバックアップとして意味がない
    run("ダンプをホストへ取り出す", "docker",
      ["compose", "cp", `${DB_SERVICE}:${containerDump}`, hostDump]);
  } else {
    console.log(`   既存のダンプを使う: ${fromArg}`);
    run("ダンプをコンテナへ送る", "docker",
      ["compose", "cp", fromArg, `${DB_SERVICE}:${containerDump}`]);
  }

  // ── 2. 空の DB を作る ──
  run("空の DB を作成", "docker",
    ["compose", "exec", "-T", DB_SERVICE, "psql", "-U", DB_USER, "-d", "postgres", "-c", `CREATE DATABASE ${restoreDb}`]);

  // ── 3. 戻す ──
  run("ダンプから復元", "docker",
    ["compose", "exec", "-T", DB_SERVICE, "pg_restore", "-U", DB_USER, "-d", restoreDb, "--no-owner", "--clean", "--if-exists", containerDump]);
} else {
  const dump = fromArg ?? hostDump;
  if (fromArg === undefined) {
    run("ダンプを取得", "pg_dump", [sourceUrl, "-Fc", "-f", dump]);
  } else {
    if (!DRY && !existsSync(dump)) {
      console.error(`❌ ダンプが見つかりません: ${dump}`);
      process.exit(1);
    }
    console.log(`   既存のダンプを使う: ${dump}`);
  }
  run("空の DB を作成", "psql", [withDatabase(sourceUrl, "postgres"), "-c", `CREATE DATABASE ${restoreDb}`]);
  run("ダンプから復元", "pg_restore",
    ["-d", withDatabase(sourceUrl, restoreDb), "--no-owner", "--clean", "--if-exists", dump]);
}

// ── 4. 中身を確かめる ──
// テーブルが在るだけでは足りない。**元と件数が合うか**まで見る
if (!DRY) {
  const tables = query(restoreDb,
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'");
  console.log(`   復元されたテーブル: ${tables} 件`);
  if (Number(tables) === 0) {
    console.error("❌ テーブルが 1 つもありません。ダンプが空か、復元先を間違えています");
    process.exit(1);
  }

  // **全テーブルを照合する。**
  // 以前は名前順の先頭 5 件だけを見ており、**空のテーブルばかり当たると
  // 何も確かめていないのと同じ**だった(2026-08)。
  const names = query(restoreDb,
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' "
    + "ORDER BY table_name").split("\n").filter(Boolean);

  let mismatch = 0;
  let withRows = 0;
  const shown = [];
  for (const t of names) {
    const before = query(SOURCE_DB, `SELECT count(*) FROM "${t}"`);
    const after = query(restoreDb, `SELECT count(*) FROM "${t}"`);
    if (before !== after) { mismatch += 1; shown.push(`❌ ${t}: 元 ${before} / 復元 ${after}`); }
    else if (Number(before) > 0) { withRows += 1; shown.push(`✅ ${t}: ${before} 件`); }
  }

  // **中身のあるテーブルを優先して出す。** 0 件の並びを見ても意味がない
  for (const line of shown.slice(0, 12)) console.log(`     ${line}`);
  if (shown.length > 12) console.log(`     … 他 ${shown.length - 12} 件`);
  console.log(`   照合: ${names.length} テーブル / 中身があるもの ${withRows} 件`);

  if (mismatch > 0) {
    console.error("\n❌ 件数が一致しないテーブルがあります。ダンプの取得時点を確認してください");
    process.exit(1);
  }

  // **全部 0 件なら「戻せた」と言えない。**
  // 手順が動くことしか示しておらず、本番の障害では役に立たない
  if (withRows === 0) {
    console.error("\n❌ すべてのテーブルが 0 件です。");
    console.error("   これでは**手順が動くこと**しか確かめられていません。");
    console.error("   `pnpm seed` でデータを入れてから、もう一度流してください。");
    process.exit(1);
  }
}

// ── 5. 鍵を確かめる ──
// **典型的な失敗**: DB は戻せたが鍵が無く、暗号化した項目が読めない。
//
// 2026-08 まで `ENCRYPTION_KEY` を見ていたが、**この名前はどこにも存在しなかった**
// (使っているのは drill 自身と、drill を見張る smoke の 2 か所だけ)。
// つまり正しく設定された環境でも必ず警告が出る = 読む人が警告を無視するようになる。
// 実際に使われている名前は `SECRET_MASTER_KEY`(未設定なら `SESSION_SECRET` を流用)。
const keyVars = ["SECRET_MASTER_KEY", "SESSION_SECRET"];
const missing = keyVars.filter((k) => (process.env[k] ?? "") === "");
// **SECRET_MASTER_KEY は未設定でも SESSION_SECRET で代替される**ので、
// 「両方無い」ときだけが本当に困る状態。片方だけを欠落として騒がない。
const masterKey = process.env["SECRET_MASTER_KEY"] ?? process.env["SESSION_SECRET"] ?? "";

/**
 * **暗号化した項目が本当に読めるかを確かめる。**
 *
 * 手順書は「人が画面で確かめる」としていたが、鍵と暗号文が揃っていれば
 * ここで判定できる。人にしか出来ないことだけを人に残す。
 *
 * 判定は 3 通り:
 *  - 暗号文が 1 件も無い … 確かめる対象が無い(**訓練の欠落ではない**)
 *  - 復号できた         … 鍵と DB の組み合わせが正しい
 *  - 復号できない       … **最も危険**。DB は戻ったのに中身が読めない
 */
function verifyDecryption(db) {
  if (masterKey === "") {
    return { state: "no-key", detail: `${keyVars.join(" / ")} がどちらも環境にありません` };
  }
  const row = query(db, 'SELECT ciphertext FROM "SecretRow" LIMIT 1');
  if (row === "") return { state: "no-data", detail: "SecretRow に暗号文がありません" };
  try {
    // `@platform/crypto` と同じ導出・同じ形式(base64(iv):base64(tag):base64(本体))。
    // salt は apps/internal-app の secret-store.ts に合わせる。
    const key = scryptSync(masterKey, "platform-secret-store", 32);
    const [iv, tag, body] = row.split(":");
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]);
    return { state: "ok", detail: "暗号化した項目を復号できました" };
  } catch (e) {
    return { state: "ng", detail: e instanceof Error ? e.message : String(e) };
  }
}

if (!DRY) {
  const v = verifyDecryption(restoreDb);
  if (v.state === "ok") {
    console.log(`   🔓 復号確認: ${v.detail}`);
  } else if (v.state === "no-data") {
    // **これは訓練の失敗ではない。** ただし「確かめていない」ことは伝える
    console.log(`   ⚪ 復号確認: ${v.detail}(確かめる対象がありません)`);
    console.log("      現在このリポジトリで暗号化して保存しているのは SecretRow だけです。");
    console.log("      暗号化する列を増やしたら、ここの確認対象も増やしてください。");
  } else if (v.state === "no-key") {
    console.log(`\n   ⚠ ${v.detail}`);
    console.log("     DB を戻せても、**暗号化した項目は読めません**。");
    console.log("     鍵は DB と別の場所に保管し、訓練でも復号まで確かめてください。");
    console.log("     (シェルに無いだけで .env にはある場合もあります)");
  } else {
    console.error(`\n❌ 復号できませんでした: ${v.detail}`);
    console.error("   **DB は戻せたのに中身が読めない状態です。** 鍵が当時のものと違う可能性があります。");
    console.error("   鍵をローテーションしたなら、古い鍵も保管されているか確認してください。");
    process.exit(1);
  }
}
if (missing.length === keyVars.length && DRY) {
  console.log(`\n   ⚠ 秘密鍵が環境にありません: ${keyVars.join(", ")}`);
  console.log("     このまま流すと、復号の確認だけ飛ばされます。");
}

const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));

console.log("\n─────────────");
if (DRY) {
  console.log(`実行される手順は ${steps.length} 個です(--dry のため実行していません)。`);
  console.log("本番の DB には接続しません。復元先は毎回新しい DB です。");
  process.exit(0);
}

console.log(`✅ 復元できました(${minutes} 分)`);
console.log(`   ダンプ: ${path.relative(ROOT, hostDump)}`);
console.log("");
// **機械で分かる分は自分で書く。**
// 「あとで記録する」は積み重なって未記録のまま残る(2026-08)。
// 実施日・所要時間・元のダンプ・照合結果は測れるので、ここで入れておく。
// **人が書くのは「詰まったこと」と「直したこと」**だけにする。
if (!DRY) {
  const recordPath = path.join(ROOT, "ops/drills/restore-drill.json");
  try {
    const rec = JSON.parse(readFileSync(recordPath, "utf8"));
    rec.lastDrillAt = new Date().toISOString();
    rec.durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    rec.restoredFrom = dumpName;
    // **人が書く欄は消さない。** 前回の指摘が残っていれば引き継ぐ
    rec.operator = rec.operator ?? null;
    writeFileSync(recordPath, `${JSON.stringify(rec, null, 2)}\n`);
    console.log(`   記録に書きました: ${path.relative(ROOT, recordPath)}`);
    console.log("   **実施者・詰まったこと・直したことは、人が足してください。**");
    console.log("");
  } catch (e) {
    console.warn("   ⚠ 記録に書けませんでした(訓練そのものは成功しています)", e);
  }
}

// **人にしか出来ないことだけを人に残す。**
// 件数の照合と復号の確認は上で機械が済ませた。残るのは
// 「画面を開いて業務が再開できると判断すること」と「詰まりを書くこと」だけ。
console.log("**ここからは人がやること**(2 つ):");
console.log(`  1. アプリを ${restoreDb} に向けて起動し、ログインして主要画面を 1 つ開く`);
console.log("     (テーブルが戻っただけでは、業務が再開できる証明になりません)");
console.log("");
console.log(`     DATABASE_URL="${mask(withDatabase(sourceUrl, restoreDb))}" pnpm dev:internal`);
console.log("     ※ パスワードは伏せて表示しています。実行時は .env の値に置き換えてください");
console.log("");
console.log("  2. 詰まった箇所を docs/ops/BACKUP_RESTORE.md に書き足し、記録を仕上げる");
console.log("     (実施日・所要時間・元のダンプ・件数の照合・復号の確認は書き込み済み):");
console.log("");
console.log(`     node tools/record-drill.mjs \\`);
console.log(`       --minutes <画面確認まで含めた実測> \\`);
console.log(`       --from ${dumpName} \\`);
console.log(`       --operator "(実施者)" \\`);
console.log(`       --issue "(詰まったこと)" \\`);
console.log(`       --next "(直したこと)"`);
console.log("");
console.log("  5. 後片付け:");
console.log(MODE === "docker"
  ? `     docker compose exec -T ${DB_SERVICE} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${restoreDb}'`
  : `     psql "${mask(withDatabase(sourceUrl, "postgres"))}" -c 'DROP DATABASE ${restoreDb}'`);
