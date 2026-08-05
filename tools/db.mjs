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
  "equipment-app": "app_equipment",
  "balance-app": "app_balance",
};
const HOST = process.env.PGHOST ?? "localhost";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const args = argv.filter((a) => a !== "--dry-run");
const [cmd, appArg, ...rest] = args;
const passthrough = rest[0] === "--" ? rest.slice(1) : rest;

const usage = () => {
  console.error("使い方: pnpm db <generate|push|migrate|studio|validate> [app|all] [--dry-run] [-- prisma引数]");
  console.error(`apps: ${Object.keys(APPS).join(" / ")}`);
  process.exit(1);
};
if (!cmd || !["generate", "push", "migrate", "studio", "validate"].includes(cmd)) usage();

const targets = !appArg || appArg === "all" ? Object.keys(APPS) : APPS[appArg] ? [appArg] : usage();
if (["migrate", "studio"].includes(cmd) && targets.length !== 1) {
  console.error(`${cmd} はアプリを1つ指定してください(例: pnpm db ${cmd} crud-template)`);
  process.exit(1);
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
