# @platform/db

データベース（Prisma のラッパー・トランザクション・キャッシュ・全文検索）。

## これは何のためか

**遅くなるのも、壊れるのも、たいていここです。**

100 人が 1 年使えば**経費 3 万件・監査ログ数十万件**になります。
**数人の間はどう書いても速い**ので、**遅くなってから気づく**——
そのときには**動いているものを触る**ことになります。

## 使う前に知っておくこと

| | |
|---|---|
| **一覧には `take` を** | 無いと**全件を読みます**。**「増え続けるか」ではなく「1 回で何件返るか」**で判断してください |
| **並び順を必ず指定** | 無いと**更新のたびに並びが変わります**——利用者は「消えた」と言います |
| **絞る列と並べる列は組で索引に** | 別々に作っても、**組み合わせでは効きません** |
| **`NOW()` を SQL で使わない** | DB の時計とアプリの時計は**別**です |
| **同時更新は `update` の条件で防ぐ** | 「読んで → 書く」は、**2 人が同時に押すと片方が消えます** |

## よく使うもの

```ts
import { createDb, createRepository, cachedQuery } from "@platform/db";
import { createDb, sql, queryRaw } from "@platform/db";
// **自分のアプリの生成物を実体で渡す**(型だけでは足りない。下記「なぜクラスを渡すか」)
import { PrismaClient } from "../generated/prisma";
const db = createDb(PrismaClient, env.DATABASE_URL);

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
    const db = createDb(PrismaClient, url);
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

## なぜクライアントの**クラス**を渡すか

**Prisma のクライアントは生成時にモデルが焼き込まれます。** 型だけを付け替えても、
実体は元のモデルしか持ちません。

このリポジトリはアプリごとに `schema.prisma` を分けており(ADR-0006)、生成先も
`apps/<app>/src/generated/prisma` に分けています。基盤が `@prisma/client` を new すると、
**そこにあるのは `packages/db` 自身の schema から生成されたもの**(モデルは `AuditLog` だけ)で、
アプリのモデルは入っていません。

2026-08 まで `createDb` は `as unknown as TClient` で型だけを差し替えていました。その結果:

- `db.systemSetting` が **`undefined`**
- 型キャストが型検査を黙らせるので **typecheck も build も smoke も preflight も通る**
- **画面を開いて初めて落ちる**

基盤が引き受けるのは**接続の作法**だけです(ドライバアダプタ・ホットリロードでの接続増殖防止・
クエリログの配線)。**どのモデルを持つかはアプリの領分**なので、アプリがクラスを渡します。

なお `@platform/db` は `PrismaClient` を**再 export しません**。そこから取ると同じ罠を踏みます。
