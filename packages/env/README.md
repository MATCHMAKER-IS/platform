# @platform/env

起動時に環境変数を zod で検証し、必須値が無ければ即失敗(fail-fast)させます。
アプリは `process.env` を直接読まず、検証済みの値を使います。

## 環境変数の読み取り口（process.env を直接読まない）

`process.env` を各所で直接読むと、未設定に気づけず「undefined 由来の謎バグ」になります。必ずこの口を通してください。

```ts
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
