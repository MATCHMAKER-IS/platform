/**
 * Prisma 操作の一本化ランナー(--schema と DATABASE_URL の指定を毎回書かなくて済むように)。
 *
 *   pnpm db generate [app|all]            # クライアント生成(URL 不要)
 *   pnpm db push [app|all]                # スキーマ即時反映(開発用・履歴なし)
 *   pnpm db migrate <app> [-- prisma引数] # 履歴つきマイグレーション(例: -- --name init)
 *   pnpm db studio <app>                  # Prisma Studio
 *   pnpm db validate [app|all]            # schema 検証
 *   共通: --dry-run で実行せずコマンドを表示
 *
 * DATABASE_URL は apps/<app>/.env の値を優先し、無ければ開発既定
 * (postgresql://app:app@localhost:5432/<db>)。ホストは PGHOST 環境変数で上書き可(devcontainer は db)。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
// **schema.prisma を持つアプリはすべて載せる。**
// balance-app が漏れており、`pnpm db generate all` でも setup でも生成されず、
// **起動時に「Can't resolve '../generated/prisma'」で落ちる**状態だった。
// 追加したら scripts/setup.sh / setup.ps1 の $Apps も合わせること
// (smoke が食い違いを見張る)。
const APPS = {
  "internal-app": "app",
  "crud-template": "app_crud",
  "line-console": "app_line",
};
const HOST = process.env.PGHOST ?? "localhost";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const args = argv.filter((a) => a !== "--dry-run");
const [cmd, appArg, ...rest] = args;
const passthrough = rest[0] === "--" ? rest.slice(1) : rest;

const usage = () => {
  console.error("使い方: pnpm db <generate|push|migrate|studio|validate|reset|baseline> [app|all] [--dry-run] [-- prisma引数]");
  console.error(`apps: ${Object.keys(APPS).join(" / ")}`);
  console.error("");
  console.error("reset は**データを全部消します**(開発用。本番では動きません)。");
  console.error("  例: pnpm db reset internal-app   → スキーマも作り直します。そのあと pnpm seed");
  console.error("  確認を省くには --yes");
  process.exit(1);
};
if (!cmd || !["generate", "push", "migrate", "studio", "validate", "reset", "baseline"].includes(cmd)) usage();

const targets = !appArg || appArg === "all" ? Object.keys(APPS) : APPS[appArg] ? [appArg] : usage();
if (["migrate", "studio"].includes(cmd) && targets.length !== 1) {
  console.error(`${cmd} はアプリを1つ指定してください(例: pnpm db ${cmd} crud-template)`);
  process.exit(1);
}

/**
 * データを全部消して作り直す。
 *
 * **本番では絶対に流さない。** 業務データが消える。
 * `isProductionRuntime()` と同じ判定に加え、対話での確認も取る
 * (`--yes` で省ける。CI やスクリプトから使うため)。
 *
 * スキーマは `db push` で作り直すので、ここでは中身だけを落とす。
 * `DROP SCHEMA public CASCADE` は**そのアプリの DB のテーブルを全部消す**。
 */
async function reset(apps) {
  // **本番判定は基盤と同じものを使う。** ここで独自に書くと判定がずれる
  if (process.env["NODE_ENV"] === "production" || process.env["APP_ENV"] === "production") {
    console.error("❌ 本番では実行できません(業務データが消えます)");
    process.exit(1);
  }

  const dbs = apps.map((a) => `${a}(${APPS[a]})`).join(" / ");
  if (!process.argv.includes("--yes")) {
    console.log("");
    console.log(`⚠ 次の DB の**データを全部消します**: ${dbs}`);
    console.log("   消えたデータは戻せません。");
    console.log("");
    const rl = (await import("node:readline/promises"))
      .createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("   続けるには `yes` と入力してください: ");
    rl.close();
    if (answer.trim() !== "yes") {
      console.log("   中止しました。");
      process.exit(0);
    }
  }

  for (const app of apps) {
    const url = envUrl(app);
    console.log(`▶ ${app}: データを消しています…`);
    // **`docker compose exec` 経由で消す。**
    // ホストに psql が無い環境が多い(復元訓練でも同じ理由で切り替えた)
    const r = spawnSync("docker", [
      "compose", "exec", "-T", "db",
      "psql", "-U", "app", "-d", APPS[app],
      "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
    ], { cwd: root, stdio: "inherit", shell: true });
    if (r.status !== 0) {
      console.error(`❌ ${app} のリセットに失敗しました`);
      console.error("   DB は起動していますか(pnpm db:up)");
      console.error(`   単体で試すには: docker compose exec -T db psql -U app -d ${APPS[app]} -c '\\dt'`);
      process.exit(1);
    }
  }

  // **スキーマまで作り直す。**
  // `DROP SCHEMA` の後にテーブルが無いままだと、アプリが起動できず
  // 「relation does not exist」で止まる。案内を出すだけでは踏まれる
  // (2026-08、実際に `push` を忘れて詰まった)。
  // ここまでやって初めて「使える状態に戻った」と言える
  console.log("");
  console.log("▶ スキーマを作り直しています…");
  for (const app of apps) {
    const r = spawnSync("pnpm", ["db", "push", app], {
      cwd: root, stdio: "inherit", shell: true,
    });
    if (r.status !== 0) {
      console.error(`❌ ${app} の db push に失敗しました`);
      console.error("   手動で実行してください: pnpm db push " + app);
      process.exit(1);
    }
  }

  console.log("");
  console.log("✅ 作り直しました。ダミーデータを入れるには:");
  console.log("   pnpm seed");
  process.exit(0);
}

if (cmd === "reset") await reset(targets);

if (cmd === "baseline") await baseline(targets);

/**
 * 本番をマイグレーション運用へ移す(ADR-0014)。
 *
 * **`migrate dev` を使わない。**
 * あちらは差分を当てるために DB を作り直す場面があり、
 * 本番のデータが消える。
 *
 * 今のスキーマを「適用済みの初期マイグレーション」として登録し、
 * **DB には触れない**。
 *
 * @param apps 対象アプリ
 */
async function baseline(apps) {
  for (const app of apps) {
    const schema = path.join(root, "apps", app, "prisma/schema.prisma");
    const dir = path.join(root, "apps", app, "prisma/migrations/0_init");

    if (fs.existsSync(dir)) {
      console.error(`❌ ${app}: prisma/migrations/0_init が既にあります`);
      console.error("   baseline は 1 度きりです。既に済んでいるなら pnpm db migrate を使ってください");
      process.exit(1);
    }

    console.log(`▶ ${app}: baseline を作ります`);
    console.log("   **DB には触れません。** ファイルを作り、適用済みとして記録するだけです");
    if (dry) { console.log("   (--dry-run のため実行しません)"); continue; }

    fs.mkdirSync(dir, { recursive: true });
    const sqlPath = path.join(dir, "migration.sql");

    // 1) 今のスキーマから初期 SQL を作る(DB は見ない)
    // **既存の `run` は cmd に依存する作りなので、ここは自前で呼ぶ。**
    // 出力を受け取る必要もある(SQL をファイルへ書く)
    const r = spawnSync("pnpm", [
      "--filter", "@platform/db", "exec", "prisma", "migrate", "diff",
      "--from-empty", "--to-schema-datamodel", schema, "--script",
    ], { cwd: root, env: { ...process.env, PRISMA_SCHEMA: schema }, shell: true, encoding: "utf8" });

    if (r.status !== 0) {
      console.error(`❌ ${app}: SQL を作れませんでした`);
      console.error(r.stderr ?? "");
      fs.rmSync(dir, { recursive: true, force: true });
      process.exit(1);
    }
    fs.writeFileSync(sqlPath, r.stdout);
    console.log(`   作成: ${path.relative(root, sqlPath)}`);
    console.log("");
    console.log("   **ここで人が確認してください。**");
    console.log("   `db push` で入った差分が漏れていないか、SQL を目で読みます。");
    console.log("   (自動で判断できません。今の本番と同じ形かは人しか分からない)");
    console.log("");
    console.log("   確認できたら、次を実行してください:");
    console.log(`     pnpm db migrate ${app} -- resolve --applied 0_init`);
    console.log(`     pnpm db migrate ${app} -- status`);
  }
  process.exit(0);
}

function envUrl(app) {
  const p = path.join(root, "apps", app, ".env");
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (m) return m[1].trim();
  }
  return `postgresql://app:app@${HOST}:5432/${APPS[app]}`;
}

let failed = false;
for (const app of targets) {
  const schema = `../../apps/${app}/prisma/schema.prisma`;
  // **`--schema` は渡せない。** Prisma 7 は設定ファイル(prisma.config.ts)があると
  // 「Passing the --schema flag is not supported」で失敗する。
  // どの schema を使うかは環境変数 `PRISMA_SCHEMA` で渡す(config 側が読む)。
  const prismaArgs = {
    generate: ["generate"],
    // Prisma 7 で `--skip-generate` は廃止(付けると「unknown or unexpected option」で失敗)。
    // generate は別コマンド(`pnpm db generate`)で明示的に流す
    push: ["db", "push"],
    migrate: ["migrate", "dev"],
    studio: ["studio"],
    validate: ["validate"],
  }[cmd].concat(passthrough);
  const full = ["--filter", "@platform/db", "exec", "prisma", ...prismaArgs];
  const needUrl = cmd !== "generate";
  const env = { ...process.env, PRISMA_SCHEMA: schema };
  if (needUrl) env.DATABASE_URL = envUrl(app);
  const label = needUrl ? `DATABASE_URL=${env.DATABASE_URL} ` : "";
  if (dry) {
    console.log(`[dry-run] PRISMA_SCHEMA=${schema} ${label}pnpm ${full.join(" ")}`);
    continue;
  }
  console.log(`▶ ${app}: prisma ${prismaArgs.join(" ")}(schema=${schema})`);
  // **`shell: true` が要る。**
  // Windows の `pnpm` は `pnpm.cmd` / `pnpm.ps1` であって実行可能ファイルではない。
  // shell を介さないと起動できず、**status が null**(= プロセスを作れていない)になる。
  // 「終了コード null」が出たら、まずここを疑う。
  // 2026-08 まで気づかれなかったのは、**このツールが Windows で
  // 一度も成功していなかった**ため(setup は pnpm を直接呼んでいた)。
  // **`NativeCommandError` が出ても失敗ではない。**
  // PowerShell は `$ErrorActionPreference = "Stop"` のとき、外部コマンドが
  // stderr に 1 行書いただけで赤いエラー表示を出す。prisma は正常時にも
  // 「Loaded Prisma config from prisma.config.ts.」を stderr に書くため、
  // ログが赤くなるが処理は成功している(終了コードで判断すること)。
  const r = spawnSync("pnpm", full, { cwd: root, stdio: "inherit", env, shell: true });
  if (r.status !== 0) {
    // **その場で止める。** 以前は最後にまとめて落としていたため、
    // 3 アプリ分の出力が流れたあとに「Command failed」とだけ出て、
    // **どのアプリの何が原因か分からなかった**
    // 起動そのものに失敗した場合は status が null。理由は error に入る
    const why = r.error ? `${r.error.message}` : `終了コード ${r.status}`;
    console.error(`\n❌ ${app} の prisma ${cmd} が失敗しました(${why})`);
    console.error(`   単体で再現するには:`);
    console.error(`     $env:PRISMA_SCHEMA="${schema}"; pnpm --filter @platform/db exec prisma ${prismaArgs.join(" ")}`);
    process.exit(1);
  }
}
if (failed) process.exit(1);
