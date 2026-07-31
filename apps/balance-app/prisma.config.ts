import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI の設定(Prisma 7 以降)。
 *
 * **接続先はここで指定する。** Prisma 7 から `schema.prisma` の `datasource.url` が
 * 廃止された(`P1012`)。CLI(`generate` / `migrate` / `db push`)はこれを読む。
 *
 * このアプリは **`prisma/schema.prisma` の `output` で生成先を分けている**
 * (`src/generated/prisma`)。全アプリが `node_modules/@prisma/client` を
 * 奪い合うと、**最後に generate したアプリしか型が通らない**ため。
 *
 * `prisma/config` の `env()` は変数が無いと例外を投げるので使わない
 * (`DATABASE_URL` を設定しない CI で `prisma generate` まで落ちる)。
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
