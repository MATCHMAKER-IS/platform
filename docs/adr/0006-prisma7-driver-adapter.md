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

## 追記(2026-07): アプリごとに生成先を分ける

**1 つの `@prisma/client` を 5 つの schema が奪い合っていた。** `generator` に
`output` を書かないと、生成先は常に `node_modules/@prisma/client` になる。
その結果、

| generate に使った schema | 結果 |
|---|---|
| `packages/db`(AuditLog のみ) | **全アプリが壊れる** |
| `internal-app` | 他の 3 アプリが壊れる |

つまり**同時に 1 アプリしか型が通らない**。`turbo run build` が Windows で動かず、
全アプリを続けてビルドしたことが無かったため、長く気づけなかった。

### 決定

1. アプリの `schema.prisma` に `output = "../src/generated/prisma"` を書く
2. `createDb<TClient>()` を型引数付きにし、アプリは**自分の生成物の型**を渡す
3. 基盤(`@platform/db`)は `PrismaClient` 全体を要求せず、
   **実際に使うメソッドだけ**を構造的な型で受ける(`client-types.ts`)

```ts
// アプリ側
import type { PrismaClient } from "../generated/prisma";
export const db = createDb<PrismaClient>(env.DATABASE_URL);
```

3 が要点。基盤が `@prisma/client` の型に触れる限り、どの schema で生成したかに
縛られ続ける。`RawCapableClient` のように**必要な形だけ**を要求すれば、
どのアプリの生成物でも渡せる。

構造的な型を書くときの注意:

- `$queryRaw<T>` のように**型引数を受ける形**にする(呼び出し側が結果の型を指定する)
- `$transaction(fn, options?)` の**第 2 引数を任意で受ける**(分離レベルの指定に使う)
- `TransactionClient` に**索引シグネチャを持たせない**。持たせると相手にも要求され、
  Prisma の生成型を渡したときに代入互換が崩れる。モデルへは `model(tx, "expense")` で触る

生成物は `.gitignore` に入れ、各アプリの `build` が `prisma generate` を先に走らせる。
`node tools/check-test-setup.mjs` が `output` の書き忘れと `prisma.config.ts` の欠落を検出する。
