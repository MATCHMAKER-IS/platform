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
