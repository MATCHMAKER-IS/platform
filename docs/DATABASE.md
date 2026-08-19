# データベース運用(@platform/db)

## 日常の操作は `pnpm db` を通す

**prisma を直接呼ばない。** Prisma 7 は設定ファイル(`prisma.config.ts`)がある場合
`--schema` を受け付けず、どの schema を使うかは環境変数 `PRISMA_SCHEMA` で渡す必要がある。
`tools/db.mjs` がその面倒を見る。

```bash
pnpm db generate all          # Prisma クライアントを生成(install 後は自動)
pnpm db push <app>|all        # スキーマを DB へ反映(開発)
pnpm db reset <app>           # **データを全部消して作り直す**(開発のみ・本番では動かない)
pnpm db studio <app>          # 中身を見る
```

`pnpm install` の `postinstall` が `generate` を流すので、
clone や差し替えの直後でも別途実行する必要はない。

## マイグレーション
- 開発中(スキーマ変更):`pnpm db migrate <app>`
- 本番/CI 適用:`prisma migrate deploy`(アプリ起動時に `runMigrations()` でも実行可)

> **開発では `db push` を使う。** マイグレーションのファイルを作らない方針
> (ADR-0013)。本番へ出す段になって baseline を切る(ADR-0014)。

```ts
import { runMigrations } from "@platform/db";
const res = await runMigrations();          // = prisma migrate deploy
if (!res.ok) { console.error(res.error); process.exit(1); }
```

## シーダー(順序実行・冪等)
```ts
import { createSeeder } from "@platform/db";
await createSeeder()
  .step("roles", async () => { for (const name of ["admin","user"]) await db.role.upsert({ where:{name}, create:{name}, update:{} }); })
  .step("admin", async () => { await db.user.upsert({ where:{ email:"a@x.co" }, create:{...}, update:{} }); })
  .run();                                    // 1つでも失敗すればそこで停止し err
```

## トランザクション(コミット / ロールバック / 分離レベル)
正常 return でコミット、例外でロールバック。`abortTransaction()` で明示的に中止。

```ts
import { withTransaction, abortTransaction } from "@platform/db";
const res = await withTransaction(db, async (tx) => {
  const from = await tx.account.update({ where:{id:a}, data:{ balance:{ decrement:100 } } });
  if (from.balance < 0) abortTransaction("残高不足");   // ロールバック
  await tx.account.update({ where:{id:b}, data:{ balance:{ increment:100 } } });
  return from;                                          // コミット
}, { isolationLevel: "Serializable" });
// 競合の自動再試行が必要なら transactionWithRetry を使う
```

## 一括インポート
```ts
import { bulkInsert, bulkInsertReturning, bulkUpsert, insertReturning } from "@platform/db";

// 高速・ID不要(チャンク分割 createMany)
await bulkInsert(db.log, rows, { chunkSize: 1000, skipDuplicates: true });

// 生成IDが必要(トランザクション内で作成し、id付きレコードを返す)
const res = await bulkInsertReturning(db, (tx) => tx.user, rows);
if (res.ok) res.value.forEach((u) => console.log(u.id));

// 冪等インポート(再実行OK)
await bulkUpsert(db, (tx) => tx.product, items, (p) => ({ where:{sku:p.sku}, create:p, update:{ price:p.price } }));

// 単一挿入後のID取得(create は生成レコードを返す)
const one = await insertReturning(db.user, { name: "山田" });
if (one.ok) console.log(one.value.id);
```

## 全文検索(PostgreSQL tsvector)
```ts
import { fullTextSearch, ginIndexSql } from "@platform/db";
// 事前にマイグレーションで GIN インデックスを作成(ginIndexSql で DDL 生成)
const res = await fullTextSearch(db, { table: "articles", columns: ["title","body"], query: "決算 発表", limit: 20 });
// 識別子は検証、検索語はパラメータ化(インジェクション対策)。日本語は pg_bigm/PGroonga の config を language に。
```

## マルチテナント(自動スコープ)
```ts
import { createTenantClient } from "@platform/db";
const tdb = createTenantClient(db, currentTenantId);   // Prisma 拡張
await tdb.order.findMany();               // 自動で WHERE tenantId = ...
await tdb.order.create({ data: {...} });  // 自動で tenantId を付与
// findUnique/単一update/delete は対象外 → 複合ユニークキー or findFirst を使う
// 明示派: tenantWhere(tenantId, where) / tenantData(tenantId, data)
```

## 監査ログ(変更差分)
```ts
import { recordAuditChange } from "@platform/db";
await recordAuditChange(db, { actor: userId, action: "user.update", target: id,
  before: oldUser, after: newUser, ignore: ["updatedAt"], redact: ["passwordHash"] });
// metadata.changes に { field: { before, after } } を記録(変わった項目のみ)
```

## クエリ結果キャッシュ
```ts
import { cachedQuery, createQueryCache } from "@platform/db";
// 単発
const res = await cachedQuery(cache, "users:active", 60, () => db.user.findMany({ where:{active:true} }));
// タグでグループ無効化
const qc = createQueryCache(cache);
await qc.cached("orders:p1", () => db.order.findMany(...), { tags:["orders"], ttlSec:120 });
await qc.invalidateTag("orders"); // orders タグの全キャッシュを無効化(バージョン繰り上げ)
```

## 普通の SQL 実行
```ts
import { rawQuery, rawExecute } from "@platform/db";
const rows = await rawQuery(db, "SELECT * FROM users WHERE age > $1 AND active = $2", [20, true]);
const upd = await rawExecute(db, "UPDATE users SET active = $1 WHERE id = $2", [false, id]); // 影響行数
// 値は必ず $1,$2 で束縛(SQL文字列にユーザー入力を連結しない)
```

## その他
- `paginate` / `cursorPaginate`(ページング)、`createRepository`(汎用CRUD+ソフト削除)
- `mapPrismaError`(P2002→409 等)、`checkDatabase`(疎通確認)、`recordAudit`(監査ログ)

---

# Prisma の書き方の例

**`docs/DATABASE.md` を統合したものです（2026-08）。**

```prisma
/// 取り込み履歴
model ImportHistory {
  id         String   @id @default(cuid())
  source     String   // "csv" | "paste"
  userId     String
  importedAt DateTime
  total      Int
  inserted   Int
  errorCount Int
  status     String   // success | partial | failed
  createdAt  DateTime @default(now())
}

/// 列表示設定(ユーザー×テーブル)
model UserColumnPref {
  userId    String
  table     String
  prefs     Json
  updatedAt DateTime @updatedAt
  @@id([userId, table])
}
```

保存フロー: `saveConfirmedExpenses`(tools/import-service-example.ts)が
`withTransaction` 内で経費の一括作成と `ImportHistory` の記録を all-or-nothing で行う。
列設定は `createColumnPrefsStore({ endpoint, userId })` が `UserColumnPref` を GET/PUT する。

## 言語設定(ユーザー別・サーバ保存)

```prisma
/// ユーザーの言語設定
model UserLocalePref {
  userId    String   @id
  locale    String   // ja | en | zh | ko
  updatedAt DateTime @updatedAt
}
```

クライアントは `createFetchLocaleStore({ endpoint: "/api/locale", userId })` で GET/PUT。
`/api/locale` は `UserLocalePref` を upsert して返す。全端末で言語が共有される。

---

# 時刻の扱い（2026-08 整理）

**層ごとに基準が違います。** 混ぜると 9 時間ずれます。

| 層 | 基準 | なぜ |
|---|---|---|
| **DB（PostgreSQL）** | **UTC** | 保存は UTC、表示で変換するのが定石。`docker-compose` に `TZ` を書いていないのは**わざと** |
| **アプリのコンテナ** | **JST**（`TZ=Asia/Tokyo`） | サーバ側で「今日」を数える処理があるため。**`tzdata` も要る**（無いと `TZ` が効かない） |
| **画面の表示** | **JST**（`formatDateJst`） | `toISOString().slice(0, 10)` は**UTC の日付**になり、**JST の 00:00〜08:59 に前日が出る** |

## 気をつけること

**生 SQL で `NOW()` を使わないでください。** DB は UTC なので、
**JS 側で作った時刻を渡す**形に統一しています（現在 0 件）。
混ぜると「アプリでは今日、DB では昨日」という状態が生まれます。

**Prisma の `DateTime` はタイムゾーンなしの列**（`timestamp(3)`）になります。
Prisma が UTC で書き、UTC で読むので**一貫していれば問題ありません**が、
**他のツールから直接見るときは UTC だと意識してください**。

**日付だけの列は `@db.Date`** を使います（4 列）。
時刻を持たせると、**タイムゾーンの変換で日付がずれます**。
