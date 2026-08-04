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

## 踏み台(bastion)経由の接続(`@platform/db/tunnel`)

本番の DB はインターネットから直接つながらないのが普通で、AWS なら RDS を
プライベートサブネットに置き、踏み台 EC2 を経由します。

```ts
import { withTunnel } from "@platform/db/tunnel";

const count = await withTunnel(
  { bastionHost: "bastion.example.com", bastionUser: "ec2-user", dbHost: "db.xxx.rds.amazonaws.com" },
  async (url) => {
    const db = createDb(url);
    return await queryRaw(db, sql`SELECT COUNT(*) FROM invoices`);
  },
);
```

`withTunnel` は**処理が終わったら必ずトンネルを閉じます**(`openTunnel` を直接使う場合は
`try/finally` で囲むこと。閉じ忘れると ssh が残り、次に同じポートで失敗します)。

- **使うのは開発時と運用作業のみ。** 本番のアプリは同じ VPC 内にあるので踏み台を経由しません。
  `tunnelConfigFromEnv()` は `BASTION_HOST` が無ければ `null` を返すので、
  「踏み台があれば使う、無ければ直接つなぐ」と書けます。
- 踏み台の情報は `.env` に置きます(`BASTION_*`。`.env.example` を参照)。
- バレル(`@platform/db`)からは出していません。`node:child_process` を
  引き込ませないためです。
- 手順とつながらないときの切り分けは [docs/ops/DEPLOY_AWS.md](../../docs/ops/DEPLOY_AWS.md)。
