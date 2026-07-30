# 0006: Prisma 7 + driver adapter(pg)

- 日付: 2026-07-14 / 状態: 採用

## 文脈
PostgreSQL への型安全なアクセスと、必要時の生 SQL の両立が要る。ORM 候補は Prisma / Drizzle。

## 決定
Prisma 7 を driver adapter(`@prisma/adapter-pg`)で採用し、接続生成は `@platform/db` の `createDb(url)` に一元化。schema はアプリ毎(`apps/<app>/prisma/schema.prisma`)。

## 検討した代替案と見送り理由
- Drizzle: 軽量だが、migrate/Studio/エコシステムと社内の既存知見で Prisma が優位。将来の再評価は妨げない。

## 影響
`prisma generate` が install 後に必須(CI / setup.sh / Dockerfile に組込済)。schema の軽量 lint は `tools/check-schema.mjs`。

## 追記(2026-07): CLI と実行時で設定が分かれた

Prisma 7 では **`schema.prisma` に `datasource.url` を書けない**(`P1012`)。
接続先の指定が 2 経路に分かれる。

| 経路 | 設定場所 |
|---|---|
| CLI(`migrate` / `db push` / `studio` / `generate`)| `prisma.config.ts` |
| アプリの実行時 | `createDb()` → `@prisma/adapter-pg` |

**片方だけ直すと「generate は通るのに動かない」**、あるいはその逆になる。
`prisma.config.ts` は **`packages/db` に 1 つだけ**置く。アプリの schema を使うときは
`--schema` で指す(`docs/ops/SETUP.md`)。アプリごとに config を置くと `--schema` と
競合して分かりにくいので置かない。config 側でも `schema` は固定しない。

`prisma/config` の `env()` ヘルパーは使わない。**変数が無いと例外を投げる**ため、
`DATABASE_URL` を設定しない CI で `prisma generate`(URL 不要)まで落ちる。
`process.env.DATABASE_URL ?? ""` を使う。

`node tools/check-test-setup.mjs` が、旧形式の残りと config の欠落を検出する。
