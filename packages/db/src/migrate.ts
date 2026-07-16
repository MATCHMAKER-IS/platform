/**
 * マイグレーション実行。`prisma migrate deploy` を起動する(アプリ起動時・CI・
 * デプロイ時に本番 DB へ適用)。開発中のスキーマ変更は `prisma migrate dev` を CLI で使う。
 * @packageDocumentation
 */
import { spawn } from "node:child_process";
import { AppError, ErrorCode, type Result } from "@platform/core";

/** {@link runMigrations} のオプション。 */
export interface MigrateOptions {
  /** 実行ディレクトリ(prisma/ を含むパッケージのルート)。 */
  cwd?: string;
  /** schema.prisma のパス(既定はプロジェクト設定に従う)。 */
  schemaPath?: string;
}

/**
 * 未適用のマイグレーションを本番 DB に適用する(`prisma migrate deploy`)。
 * @returns 成功なら `ok`、失敗は `DATABASE` の `err`
 *
 * @example
 * ```ts
 * // アプリ起動時
 * const res = await runMigrations();
 * if (!res.ok) { logger.error(res.error); process.exit(1); }
 * ```
 * @param options.dir マイグレーションのディレクトリ
 * @param options.dryRun 実行せずに確認だけするか
 */
export function runMigrations(options: MigrateOptions = {}): Promise<Result<void>> {
  return new Promise((resolve) => {
    const args = ["prisma", "migrate", "deploy"];
    if (options.schemaPath) args.push("--schema", options.schemaPath);
    const child = spawn("npx", args, { cwd: options.cwd, stdio: "inherit" });
    child.on("error", (e) =>
      resolve({ ok: false, error: new AppError(ErrorCode.DATABASE, "マイグレーションの起動に失敗しました", { cause: e }) }),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve({ ok: true, value: undefined })
        : resolve({ ok: false, error: new AppError(ErrorCode.DATABASE, `マイグレーションが失敗しました(exit ${code})`) }),
    );
  });
}
