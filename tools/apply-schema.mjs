#!/usr/bin/env node
/**
 * **スキーマの適用**。`db push` と `migrate deploy` を**自動で選ぶ**。
 *
 * ```bash
 * node tools/apply-schema.mjs internal-app
 * node tools/apply-schema.mjs internal-app --dry-run
 * ```
 *
 * 【なぜ「選ぶ」必要があるか】
 * このリポジトリは **開発中は `db push`、本番運用を始めたらマイグレーション**
 * という段取りになっている(ADR 0013 → 0014)。
 * ところが `db push` を叩く場所は **4 か所**に散っていた:
 *
 * - `apps/internal-app/Dockerfile.migrate`(**本番のデプロイ経路**)
 * - `scripts/setup.sh`(開発環境の初期化)
 * - `.github/workflows/ci.yml`
 * - `.github/workflows/e2e.yml`
 *
 * `pnpm db baseline` で切り替えたとき、**この 4 か所を全部直さないと
 * 本番で `db push` が走り続ける**。ADR 0014 が
 * 「本番で `db push` を実行しない」と明記している、まさにその状態になる。
 * **列の削除が無警告で走る**ので、気づくのはデータが消えた後。
 *
 * **「忘れずに直す」を人に求めない。** 履歴があるかどうかを見て、ここが決める。
 *
 * | `prisma/migrations/` | すること |
 * |---|---|
 * | 無い | `prisma db push`(開発中。履歴を持たない段階) |
 * | ある | `prisma migrate deploy`(**本番でも安全な唯一の方法**) |
 *
 * 【`--schema` を使わない理由】
 * Prisma 7 は `prisma.config.ts` があると `--schema` を受け付けない。
 * どの schema を使うかは環境変数 `PRISMA_SCHEMA` で渡す(ADR 0006 / 0014 の追記)。
 */
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const app = args.find((a) => !a.startsWith("--"));

if (app === undefined) {
  console.error("使い方: node tools/apply-schema.mjs <アプリ名> [--dry-run]");
  console.error("  例:   node tools/apply-schema.mjs internal-app");
  process.exit(2);
}

const appDir = path.join(ROOT, "apps", app);
const schema = path.join(appDir, "prisma", "schema.prisma");
const migrationsDir = path.join(appDir, "prisma", "migrations");

if (!existsSync(schema)) {
  console.error(`❌ ${path.relative(ROOT, schema)} がありません(アプリ名を確認してください)`);
  process.exit(1);
}

/**
 * マイグレーション履歴があるか。
 *
 * **ディレクトリの有無だけでは足りない。** 空の `migrations/` が
 * 残っていると `migrate deploy` は「何も適用するものが無い」で通ってしまい、
 * **スキーマが古いままアプリが起動する**。中身まで見る。
 */
const hasMigrations =
  existsSync(migrationsDir) &&
  readdirSync(migrationsDir, { withFileTypes: true }).some(
    (e) => e.isDirectory() && existsSync(path.join(migrationsDir, e.name, "migration.sql")),
  );

// **本番かどうか。** `APP_ENV` を優先する(dev / staging / production)
const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
const isProduction = appEnv === "production";

const mode = hasMigrations ? "migrate" : "push";
const command = hasMigrations ? ["prisma", "migrate", "deploy"] : ["prisma", "db", "push"];

console.log(`▶ ${app}: ${hasMigrations ? "マイグレーション履歴あり" : "マイグレーション履歴なし"}(APP_ENV=${appEnv})`);
console.log(`  → ${command.join(" ")}`);

if (mode === "push" && isProduction) {
  // **止めはしないが、黙って通しもしない。**
  // ADR 0013 は「本番運用を始めるまでは db push」と決めている。
  // ただし**始まった瞬間に危険側へ倒れる**ので、毎回目に入る形で出す。
  console.warn("");
  console.warn("⚠ 本番で `db push` を実行しようとしています。");
  console.warn("  **消せないデータが入る前に**、マイグレーションへ切り替えてください:");
  console.warn(`      pnpm db baseline ${app}`);
  console.warn(`      pnpm db migrate ${app} -- resolve --applied 0_init`);
  console.warn("  切り替えると、この入口は自動で `migrate deploy` に変わります(ADR 0014)。");
  console.warn("");
}

if (dryRun) {
  console.log("(--dry-run のため実行しません)");
  process.exit(0);
}

const r = spawnSync("pnpm", ["exec", ...command], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    // **Prisma 7 は `--schema` を受け付けない。** 環境変数で渡す
    PRISMA_SCHEMA: path.relative(ROOT, schema).split(path.sep).join("/"),
  },
});

process.exit(r.status ?? 1);
