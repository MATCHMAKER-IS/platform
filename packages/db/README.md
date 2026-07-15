# @platform/db

Prisma をラップした DB アクセス部品。**通常の CRUD は Prisma Client**、
**複雑な集計は `queryRaw`/`executeRaw`(パラメータ化された生SQL)** を使います。

```ts
import { createDb, sql, queryRaw } from "@platform/db";
const db = createDb(env.DATABASE_URL);

// 生SQL(値は自動でプレースホルダ化 → SQLインジェクション対策)
const res = await queryRaw<{ id: number; total: bigint }>(
  db,
  sql`SELECT user_id AS id, COUNT(*) AS total FROM orders
      WHERE created_at >= ${from} GROUP BY user_id`,
);
```

- 文字列連結でクエリを組まないこと(必ず `sql\`\`` タグを使う)。
- 業務テーブルは `prisma/schema.prisma` をアプリ側で拡張して定義します。
