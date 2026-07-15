/**
 * シーダー。名前付きステップを順に実行する。各ステップは upsert 等で冪等に書き、
 * 再実行しても壊れないようにするのが推奨。
 * @packageDocumentation
 */
import { AppError, ErrorCode, tryCatch, ok, err, type Result } from "@platform/core";

/** シードのログ出力先(既定 console)。 */
export interface SeedLogger {
  info(message: string): void;
  error(message: string): void;
}

/** シーダー。 */
export interface Seeder {
  /** ステップを追加する(チェーン可能)。 */
  step(name: string, run: () => Promise<void>): Seeder;
  /** 追加順に全ステップを実行する。1 つでも失敗したらそこで停止し err を返す。 */
  run(): Promise<Result<{ completed: string[] }>>;
}

/**
 * シーダーを作る。
 * @param logger 進捗ログ出力先(既定は console)
 *
 * @example
 * ```ts
 * const res = await createSeeder()
 *   .step("roles", async () => {
 *     for (const name of ["admin", "user"]) {
 *       await db.role.upsert({ where: { name }, create: { name }, update: {} });
 *     }
 *   })
 *   .step("admin-user", async () => {
 *     await db.user.upsert({ where: { email: "admin@example.com" }, create: {...}, update: {} });
 *   })
 *   .run();
 * ```
 */
export function createSeeder(logger: SeedLogger = console): Seeder {
  const steps: { name: string; run: () => Promise<void> }[] = [];
  const api: Seeder = {
    step(name, run) {
      steps.push({ name, run });
      return api;
    },
    async run() {
      const completed: string[] = [];
      for (const s of steps) {
        const r = await tryCatch(s.run);
        if (!r.ok) {
          logger.error(`シード失敗: ${s.name}`);
          return err(new AppError(ErrorCode.DATABASE, `シード「${s.name}」に失敗しました`, { cause: r.error.cause ?? r.error, details: { completed } }));
        }
        completed.push(s.name);
        logger.info(`シード完了: ${s.name}`);
      }
      return ok({ completed });
    },
  };
  return api;
}
