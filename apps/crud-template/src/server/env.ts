/**
 * 環境変数定義。@platform/env で起動時に検証する(internal-app と同じパターン)。
 * DATABASE_URL は省略可: 省略時はインメモリで動く(PERSISTENCE=prisma のときのみ必須)。
 * @packageDocumentation
 */
import { parseEnv, optionalEnv, z } from "@platform/env";

/**
 * このアプリの環境変数。
 *
 * `@platform/env` の `parseEnv` で検証している(**基盤の実装を使う**)。
 * 同名なのは「アプリごとに必要な変数が違う」ため。基盤に定義を置くと、
 * 全アプリが全アプリの変数を要求することになる。
 */
export const env = parseEnv(
  z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().optional().describe("接続先 PostgreSQL(PERSISTENCE=prisma のとき必須)"),
  }),
);

/** 永続化モード。"prisma" で PostgreSQL、それ以外はインメモリ(開発用)。 */
export const usePrisma = optionalEnv("PERSISTENCE") === "prisma";
