# @platform/env

環境変数。**起動時に検査して、無いまま動かない**ようにします。

## これは何のためか

**設定が無いまま起動して、使われたときに落ちる**——これが最も困ります。
「昨日まで動いていたのに」の多くは、**設定の入れ忘れ**です。

**起動時に落とせば、その場で気づけます。**

## 使う前に知っておくこと

| | |
|---|---|
| **`process.env` を直接読まない** | 型も必須も検査されません。**無いまま動いて、後で落ちます** |
| **`.env.example` に必ず書く** | 書かないと、**引き継いだ人が「何を設定すればよいか」に気づけません**（検査で見張っています） |
| **秘密を既定値にしない** | 「とりあえず動く」ために鍵を埋め込むと、**そのまま本番に出ます** |
| **必須にするか迷ったら必須に** | 省略可にすると、**無いことに気づかないまま動きます** |

## よく使うもの

```ts
import { isSecretName, describeEnv, maskSecrets } from "@platform/env";
import { parseEnv, requireEnv, optionalEnv, z } from "@platform/env";

// スキーマ検証（起動時に fail-fast）
export const env = parseEnv(z.object({ DATABASE_URL: z.string().url() }));

// 秘密値など、スキーマ外の必須値
const { SESSION_SECRET } = requireEnv(["SESSION_SECRET"]);  // 欠けていれば CONFIG エラー
const masterKey = optionalEnv("SECRET_MASTER_KEY", SESSION_SECRET);  // 既定値付き
```

本番だけ必須にしたい場合は `NODE_ENV` で分岐します（internal-app の `server/env.ts` が実例）。

## 説明の生成・マスキング

```ts
import { describeEnv, renderEnvExample, maskSecrets } from "@platform/env";

describeEnv(schema);        // 変数名・必須・型・既定値・説明・秘密判定の一覧
renderEnvExample(schema);   // .env.example の中身を生成（必須/任意でセクション分け）
maskSecrets(env);           // ログ出力用。KEY/SECRET/TOKEN/PASSWORD を含む名前は *** に
```

`isSecretName` は名前から秘密値を判定します（`_KEY` / `_SECRET` / `_TOKEN` / `_PASSWORD` / `API_KEY` 等）。ログや管理画面に設定値を出すときは必ず `maskSecrets` を通してください。

## 秘密値の強度チェック

「開発用の既定値のまま本番公開」「短すぎる鍵」を起動時に検出します。

```ts
import { assertSecretStrength } from "@platform/env";

// 本番なら error 級の問題で起動を止める。開発なら警告のみ
assertSecretStrength({ SESSION_SECRET, ADMIN_PASSWORD }, { isProduction: true });
```

判定基準:

| 状態 | 判定 |
|---|---|
| `change-me` / `dev-` 始まり / `admin1234` など開発既定値らしい | **error**（本番は起動失敗） |
| 12 文字未満 | **error** |
| 12〜15 文字 | warn（32 文字以上を推奨） |
| 文字種が 1 種類のみ | warn |

`checkSecretStrength` は判定結果を返すだけ（例外なし）、`assertSecretStrength` は本番で error があれば `CONFIG` エラーを投げます。

## 本番判定は `isProductionRuntime()` を使う

`NODE_ENV === "production"` だけで判定すると、**`next build` でも真**になる。
ビルドはページデータ収集のためにルートハンドラを読み込むので、そこで秘密値を必須に
すると**ビルドマシンに本番の秘密を置くまでビルドできない**。

```ts
if (isProductionRuntime()) {
  const required = requireEnv(["SESSION_SECRET", "ADMIN_PASSWORD"]);
  assertSecretStrength(required, { isProduction: true });
}
```

`NEXT_PHASE=phase-production-build` を見てビルド中を除外する。
**実行時には改めて検証される**ので、本番の安全性は落ちない。

## ビルド中だけ既定値にする

`next build` はページデータ収集のためにサーバ側モジュールを読み込む。
`DATABASE_URL` のような値を必須にすると、**ビルドマシンに接続情報を置くまで
ビルドできない**。

```ts
DATABASE_URL: requiredAtRuntime(
  z.string().url(),                                        // 実行時はこれ
  z.string().default("postgresql://build@localhost:5432/build"),  // ビルド中はこれ
),
```

**実行時には元の検証がそのまま効く**ので、安全性は落ちない。
判定は `NEXT_PHASE=phase-production-build` を見ている(`isBuildPhase()`)。
