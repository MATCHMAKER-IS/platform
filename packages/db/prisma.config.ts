import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI の設定(Prisma 7 以降)。
 *
 * **接続先はここで指定する。** Prisma 7 から `schema.prisma` の `datasource.url` が
 * 廃止された(`P1012`)。CLI(`generate` / `migrate` / `db push` / `studio`)はこれを読む。
 *
 * アプリの実行時は別経路で、`createDb()` が `@prisma/adapter-pg` に接続文字列を渡す。
 * **CLI と実行時で経路が分かれている**ので、片方だけ直すと
 * 「generate は通るのに動かない」状態になる。
 *
 * `schema` はここでは指定しない。アプリの schema を使うときは
 * `--schema` で上書きするのがこのリポジトリの作法(docs/ops/SETUP.md)。
 *
 *     pnpm --filter @platform/db exec prisma generate \
 *       --schema=../../apps/internal-app/prisma/schema.prisma
 *
 * ここで `schema` を固定すると、`--schema` との組み合わせで混乱するため書かない。
 *
 * `prisma/config` の `env()` ヘルパーは使わない。
 * **変数が無いと例外を投げる**ため、`DATABASE_URL` を設定しない CI で
 * `prisma generate`(URL 不要)まで落ちる。
 */
export default defineConfig({
  datasource: {
    // env() ではなく process.env を直接読む(理由は上のコメント)
    url: process.env.DATABASE_URL ?? "",
  },
});
