# @platform/core

**失敗の形を全体で揃える**ための土台です。112 パッケージのうち 54 がこれに依存しています。

ここが変わると全体に波及するため、`check-core-signatures` が関数の形を記録しています。

## Result — 例外を投げない失敗表現

```ts
import { ok, err, tryCatch, AppError, ErrorCode, type Result } from "@platform/core";

function findUser(id: string): Result<User> {
  const u = db.get(id);
  if (!u) return err(new AppError(ErrorCode.NOT_FOUND, "利用者が見つかりません"));
  return ok(u);
}

const r = findUser("u1");
if (!r.ok) return showError(r.error);   // ここで型が絞られる
console.log(r.value.name);
```

**なぜ例外を投げないか。** 呼び出し側が「失敗しうる」ことに気づけるからです。
例外は握り潰されても型では分からず、上まで飛んで画面が白くなります。

外部ライブラリのように例外を投げるものは `tryCatch` で包みます。

```ts
const parsed = tryCatch(() => JSON.parse(text));
if (!parsed.ok) return err(parsed.error);
```

## ErrorCode — 失敗の種類

| コード | 使う場面 | HTTP |
|---|---|---|
| `VALIDATION` | 入力が不正 | 400 |
| `UNAUTHORIZED` | 未ログイン | 401 |
| `FORBIDDEN` | 権限がない | 403 |
| `NOT_FOUND` | 対象がない | 404 |
| `CONFLICT` | 競合（重複・状態の不一致） | 409 |
| `RATE_LIMITED` | 回数の超過 | 429 |
| `EXTERNAL` | 外部サービスの失敗 | 502 |
| `DATABASE` | DB の失敗 | 503 |
| `CONFIG` | 設定の誤り（起動時に気づきたい） | 500 |
| `INTERNAL` | 想定外 | 500 |

`httpStatusFor(error)` がこの対応表を引きます。**認可の失敗が 500 になる**ような
取り違えを防ぐため、API では必ずこれを通してください。

```ts
import { toErrorEnvelope, httpStatusFor } from "@platform/core";

catch (e) {
  const err = AppError.from(e);
  return Response.json(toErrorEnvelope(err), { status: httpStatusFor(err.code) });
}
```

`toErrorEnvelope` は**利用者に見せてよい形**に整えます（内部の詳細は落とす）。

## 再試行してよいか

```ts
import { isRetryable, isPermanent, defaultShouldRetry } from "@platform/core";

if (isRetryable(error)) await retry();      // EXTERNAL / DATABASE / RATE_LIMITED
if (isPermanent(error)) giveUp();           // VALIDATION / FORBIDDEN など
```

**判断を各所で書かない**ことが要点です。「タイムアウトは再試行、権限エラーは再試行しない」を
画面ごとに書くと、必ずどこかで取り違えます。

## 落ちにくくする道具

| 関数 | 何をするか |
|---|---|
| `createBulkhead` | 同時実行数を絞る。**1 つの重い処理で全体が止まる**のを防ぐ |
| `createLifecycle` | 起動と停止の順序を管理する。停止時に処理中の要求を待つ |
| `installProcessGuards` | 拾われなかった例外でプロセスが黙って死ぬのを防ぐ |

```ts
// 外部 API への同時接続を 5 本までに絞る
const bulkhead = createBulkhead({ maxConcurrent: 5, maxQueue: 100 });
const result = await bulkhead.run(() => callExternalApi());
```

## 変更するときの注意

このパッケージは**多数が依存する**ため、引数や戻り値を変えると全体が壊れます。
名前を消さなくても型検査でしか分からないため、`check-core-signatures` が形を記録しています。

意図した変更なら `node tools/check-core-signatures.mjs --update` で記録を更新し、
**なぜ変えたかをコミットメッセージに書いてください**。
