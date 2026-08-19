/**
 * 環境変数定義。@platform/env で起動時に検証する(internal-app と同じパターン)。
 * **DATABASE_URL は必須**(この雛形は DB を使う前提)。
 * 実験用にメモリで動かしたいときだけ `PERSISTENCE=memory` を指定する。
 * @packageDocumentation
 */
import { parseEnv, optionalEnv, requiredAtRuntime, z } from "@platform/env";

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
    // **必須にする。** 以前は省略可(既定インメモリ)だったが、
    // `services.ts` が生成物を先頭で import しており、結局 `prisma generate` が要った。
    // 「何も設定せず動く」と謳いながら実際は動かない状態だったので、前提を揃えた。
    DATABASE_URL: requiredAtRuntime(
      z.string().url().describe("接続先 PostgreSQL"),
      z.string().default("postgresql://build@localhost:5432/build"),
    ),
  }),
);

/**
 * DB を使うか。**既定は使う。**
 *
 * 実験用にメモリで動かしたいときだけ `PERSISTENCE=memory` を指定する
 * (再起動で消えるので、開発の使い捨て以外には向かない)。
 */
export const usePrisma = optionalEnv("PERSISTENCE") !== "memory";
