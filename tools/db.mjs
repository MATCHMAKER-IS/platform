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

const root = new URL("..", import.meta.url).pathname;
const APPS = { "internal-app": "app", "crud-template": "app_crud", "equipment-app": "app_equipment" };
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
  const prismaArgs = {
    generate: ["generate", `--schema=${schema}`],
    push: ["db", "push", `--schema=${schema}`, "--skip-generate"],
    migrate: ["migrate", "dev", `--schema=${schema}`],
    studio: ["studio", `--schema=${schema}`],
    validate: ["validate", `--schema=${schema}`],
  }[cmd].concat(passthrough);
  const full = ["--filter", "@platform/db", "exec", "prisma", ...prismaArgs];
  const needUrl = cmd !== "generate";
  const env = needUrl ? { ...process.env, DATABASE_URL: envUrl(app) } : process.env;
  const label = needUrl ? `DATABASE_URL=${env.DATABASE_URL} ` : "";
  if (dry) {
    console.log(`[dry-run] ${label}pnpm ${full.join(" ")}`);
    continue;
  }
  console.log(`▶ ${app}: prisma ${prismaArgs.join(" ")}`);
  const r = spawnSync("pnpm", full, { cwd: root, stdio: "inherit", env });
  if (r.status !== 0) failed = true;
}
if (failed) process.exit(1);
